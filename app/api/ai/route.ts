import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  AI_GENERATION_TIMEOUT_MS,
  getAiGovernanceMetadata,
} from "@/lib/ai/governance";
import {
  beginGenerationAttempt,
  recordUsageEvent,
  releaseGenerationAttempt,
} from "@/lib/ai/generation";
import {
  validateAiOutput,
} from "@/lib/ai/output-guard";
import { classifyAiProviderError } from "@/lib/ai/provider-errors";
import { CLAUDE_PRIMARY_MODEL, TEMPLATE_TYPES } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { GdprScrubber } from "@/lib/gdpr/scrubber";
import {
  detectPotentialSensitiveContent,
  formatPotentialSensitiveContentMessage,
} from "@/lib/gdpr/server-guard";
import {
  createRouteContext,
  jsonWithContext,
  logRouteError,
  logRouteInfo,
  withRequestContext,
} from "@/lib/server/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseUserSettings } from "@/lib/validations/user-settings";

const serverScrubber = new GdprScrubber();

const RequestSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  scrubbedInput: z.string().min(10).max(5000),
  scrubberStats: z.object({
    namesReplaced: z.number().int().min(0).max(5000),
    piiTokensReplaced: z.number().int().min(0).max(5000),
  }),
});

type RouteContext = ReturnType<typeof createRouteContext>;
type AdminClient = ReturnType<typeof createAdminClient>;
type ClaudeStream = Awaited<ReturnType<Anthropic["messages"]["stream"]>>;
type ClaudeStreamChunk = ClaudeStream extends AsyncIterable<infer Chunk> ? Chunk : never;
type ClaudeStreamIterator = AsyncIterator<ClaudeStreamChunk>;

const OUTPUT_GUARD_BLOCKED_MESSAGE =
  "AI-svaret stoppades eftersom det kan innehålla personuppgifter eller nya elevmarkörer. Försök igen med tydligare avidentifierat underlag.";

function getTextDelta(chunk: ClaudeStreamChunk): string | null {
  const maybeChunk = chunk as {
    delta?: { text?: unknown; type?: unknown };
    type?: unknown;
  };

  if (
    maybeChunk.type === "content_block_delta" &&
    maybeChunk.delta?.type === "text_delta" &&
    typeof maybeChunk.delta.text === "string"
  ) {
    return maybeChunk.delta.text;
  }

  return null;
}

async function readNextTextDelta(
  iterator: ClaudeStreamIterator,
): Promise<{ done: true } | { done: false; text: string }> {
  while (true) {
    const nextChunk = await iterator.next();

    if (nextChunk.done) {
      return { done: true };
    }

    const text = getTextDelta(nextChunk.value);

    if (text) {
      return { done: false, text };
    }
  }
}

async function recordBlockedOutput(params: {
  adminSupabase: AdminClient;
  clientReportedPiiTokensRemoved: number;
  context: RouteContext;
  effectiveScrubbedInput: string;
  generatedText: string;
  governanceMetadata: ReturnType<typeof getAiGovernanceMetadata>;
  outputGuardResult?: ReturnType<typeof validateAiOutput>;
  reservedTransform: boolean;
  templateType: z.infer<typeof RequestSchema>["templateType"];
  totalPiiTokensRemoved: number;
  userId: string;
}): Promise<void> {
  const outputGuardResult =
    params.outputGuardResult ??
    validateAiOutput({
      inputText: params.effectiveScrubbedInput,
      outputText: params.generatedText,
    });

  if (params.reservedTransform) {
    await releaseGenerationAttempt(params.adminSupabase, params.userId, params.context);
  }

  await recordUsageEvent({
    adminSupabase: params.adminSupabase,
    clientReportedPiiTokensRemoved: params.clientReportedPiiTokensRemoved,
    context: params.context,
    governanceMetadata: params.governanceMetadata,
    outputGuardPassed: false,
    outputGuardWarnings: [
      ...outputGuardResult.blockingReasons,
      ...outputGuardResult.warnings,
    ],
    templateType: params.templateType,
    totalPiiTokensRemoved: params.totalPiiTokensRemoved,
    userId: params.userId,
  });

  logRouteInfo(params.context, "Blocked AI output during streaming validation.", {
    blockingReasonCount: outputGuardResult.blockingReasons.length,
    outputPlaceholderCount: outputGuardResult.outputPlaceholders.length,
    requiredPlaceholderCount: outputGuardResult.requiredPlaceholders.length,
    warningCount: outputGuardResult.warnings.length,
  });
}

function buildAttemptFailureResponse(context: RouteContext, reason: string): Response {
  switch (reason) {
    case "profile_not_found":
      return jsonWithContext({ error: "Profil hittades inte" }, { status: 404 }, context);
    case "quota_exceeded":
      return jsonWithContext(
        { error: "Månadens gräns är nådd", code: "QUOTA_EXCEEDED" },
        { status: 403 },
        context,
      );
    case "rate_limited":
      return jsonWithContext(
        { error: "För många förfrågningar. Vänta en stund och försök igen." },
        { status: 429 },
        context,
      );
    default:
      return jsonWithContext(
        { error: "Kunde inte starta genereringen just nu." },
        { status: 500 },
        context,
      );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "ai");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonWithContext(
      { error: "Du behöver logga in för att fortsätta." },
      { status: 401 },
      context,
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonWithContext({ error: "Ogiltig förfrågan" }, { status: 400 }, context);
  }

  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonWithContext({ error: "Ogiltig förfrågan" }, { status: 400 }, context);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonWithContext(
      { error: "AI-tjänsten är inte konfigurerad." },
      { status: 500 },
      context,
    );
  }

  const { scrubbedInput, scrubberStats, templateType } = parsed.data;
  const { data: settingsProfile, error: settingsError } = await supabase
    .from("profiles")
    .select("user_settings")
    .eq("id", user.id)
    .maybeSingle();

  if (settingsError) {
    logRouteError(context, "Failed to load profile settings for server scrubber.", settingsError);
    return jsonWithContext(
      { error: "Kunde inte kontrollera dina skrivinställningar just nu." },
      { status: 500 },
      context,
    );
  }

  const scrubbingUserSettings = parseUserSettings(settingsProfile?.user_settings);
  const serverScrubResult = serverScrubber.scrub(scrubbedInput, {
    safeCapitalizedWords: scrubbingUserSettings.safeCapitalizedWords,
  });
  const effectiveScrubbedInput = serverScrubResult.scrubbedText;
  const potentialSensitiveContent = detectPotentialSensitiveContent(effectiveScrubbedInput);

  if (potentialSensitiveContent.length > 0) {
    return jsonWithContext(
      { error: formatPotentialSensitiveContentMessage(potentialSensitiveContent) },
      { status: 400 },
      context,
    );
  }

  let adminSupabase: AdminClient;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    logRouteError(context, "Failed to create Supabase admin client.", error);
    return jsonWithContext(
      { error: "Genereringstjänsten saknar serverkonfiguration för Supabase." },
      { status: 500 },
      context,
    );
  }

  const generationAttempt = await beginGenerationAttempt(adminSupabase, user.id, context);

  if (!generationAttempt) {
    return jsonWithContext(
      { error: "Kunde inte starta genereringen just nu." },
      { status: 500 },
      context,
    );
  }

  if (!generationAttempt.allowed) {
    return buildAttemptFailureResponse(context, generationAttempt.reason);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const reservedTransform = generationAttempt.reserved_transform;
  const clientReportedPiiTokensRemoved =
    scrubberStats.namesReplaced + scrubberStats.piiTokensReplaced;
  const serverAddedPiiTokensRemoved =
    serverScrubResult.stats.namesReplaced + serverScrubResult.stats.piiTokensReplaced;
  const totalPiiTokensRemoved = clientReportedPiiTokensRemoved + serverAddedPiiTokensRemoved;
  const userSettings = parseUserSettings(generationAttempt.user_settings);
  const systemPrompt = getSystemPrompt(templateType, { userSettings });
  const governanceMetadata = getAiGovernanceMetadata();
  let generatedText = "";
  let claudeStream: ClaudeStream;
  let iterator!: ClaudeStreamIterator;
  let initialTextChunk = "";

  try {
    claudeStream = await anthropic.messages.stream(
      {
        model: CLAUDE_PRIMARY_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Här är lärarens anteckningar (all personinformation är borttagen av GDPR-skölden):\n\n${effectiveScrubbedInput}`,
          },
        ],
      },
      {
        signal: AbortSignal.timeout(AI_GENERATION_TIMEOUT_MS),
      },
    );

    iterator = claudeStream[Symbol.asyncIterator]();
    const initialDelta = await readNextTextDelta(iterator);

    if (!initialDelta.done) {
      initialTextChunk = initialDelta.text;
      generatedText = initialTextChunk;
    }
  } catch (error) {
    if (reservedTransform) {
      await releaseGenerationAttempt(adminSupabase, user.id, context);
    }

    const classifiedError = classifyAiProviderError(error);
    logRouteError(context, "AI provider generation failed.", error, {
      aiErrorCode: classifiedError.code,
      aiErrorStatus: classifiedError.status,
      timeoutMs: AI_GENERATION_TIMEOUT_MS,
    });
    return jsonWithContext(
      {
        error: classifiedError.userMessage,
        code: classifiedError.code,
      },
      { status: classifiedError.status },
      context,
    );
  }

  const initialOutputGuardResult = validateAiOutput({
    inputText: effectiveScrubbedInput,
    outputText: generatedText,
  });

  if (!initialOutputGuardResult.passed) {
    await recordBlockedOutput({
      adminSupabase,
      clientReportedPiiTokensRemoved,
      context,
      effectiveScrubbedInput,
      generatedText,
      governanceMetadata,
      outputGuardResult: initialOutputGuardResult,
      reservedTransform,
      templateType,
      totalPiiTokensRemoved,
      userId: user.id,
    });

    return jsonWithContext(
      {
        error: OUTPUT_GUARD_BLOCKED_MESSAGE,
        code: "OUTPUT_GUARD_BLOCKED",
      },
      { status: 502 },
      context,
    );
  }

  const responseHeaders = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Skolskribenten-Output-Guard": "passed",
  });
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (initialTextChunk) {
          controller.enqueue(encoder.encode(initialTextChunk));
        }

        while (true) {
          const nextDelta = await readNextTextDelta(iterator);

          if (nextDelta.done) {
            break;
          }

          const nextGeneratedText = generatedText + nextDelta.text;
          const outputGuardResult = validateAiOutput({
            inputText: effectiveScrubbedInput,
            outputText: nextGeneratedText,
          });

          if (!outputGuardResult.passed) {
            await recordBlockedOutput({
              adminSupabase,
              clientReportedPiiTokensRemoved,
              context,
              effectiveScrubbedInput,
              generatedText: nextGeneratedText,
              governanceMetadata,
              outputGuardResult,
              reservedTransform,
              templateType,
              totalPiiTokensRemoved,
              userId: user.id,
            });
            controller.error(new Error(OUTPUT_GUARD_BLOCKED_MESSAGE));
            return;
          }

          generatedText = nextGeneratedText;
          controller.enqueue(encoder.encode(nextDelta.text));
        }

        const outputGuardResult = validateAiOutput({
          inputText: effectiveScrubbedInput,
          outputText: generatedText,
        });

        if (!outputGuardResult.passed) {
          await recordBlockedOutput({
            adminSupabase,
            clientReportedPiiTokensRemoved,
            context,
            effectiveScrubbedInput,
            generatedText,
            governanceMetadata,
            outputGuardResult,
            reservedTransform,
            templateType,
            totalPiiTokensRemoved,
            userId: user.id,
          });
          controller.error(new Error(OUTPUT_GUARD_BLOCKED_MESSAGE));
          return;
        }

        await recordUsageEvent({
          adminSupabase,
          clientReportedPiiTokensRemoved,
          context,
          governanceMetadata,
          outputGuardPassed: true,
          outputGuardWarnings: outputGuardResult.warnings,
          templateType,
          totalPiiTokensRemoved,
          userId: user.id,
        });
        controller.close();
      } catch (error) {
        if (reservedTransform) {
          await releaseGenerationAttempt(adminSupabase, user.id, context);
        }

        const classifiedError = classifyAiProviderError(error);
        logRouteError(context, "AI provider stream failed.", error, {
          aiErrorCode: classifiedError.code,
          aiErrorStatus: classifiedError.status,
          timeoutMs: AI_GENERATION_TIMEOUT_MS,
        });
        controller.error(new Error(classifiedError.userMessage));
      }
    },
  });

  return withRequestContext(
    new Response(responseStream, {
      headers: responseHeaders,
    }),
    context,
  );
}
