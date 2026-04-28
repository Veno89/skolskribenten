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
  serializeOutputGuardWarnings,
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
  const serverScrubResult = serverScrubber.scrub(scrubbedInput);
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

  try {
    const claudeStream = await anthropic.messages.stream(
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

    for await (const chunk of claudeStream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        generatedText += chunk.delta.text;
      }
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

  const outputGuardResult = validateAiOutput({
    inputText: effectiveScrubbedInput,
    outputText: generatedText,
  });

  if (!outputGuardResult.passed) {
    if (reservedTransform) {
      await releaseGenerationAttempt(adminSupabase, user.id, context);
    }

    await recordUsageEvent({
      adminSupabase,
      clientReportedPiiTokensRemoved,
      context,
      governanceMetadata,
      outputGuardPassed: false,
      outputGuardWarnings: [
        ...outputGuardResult.blockingReasons,
        ...outputGuardResult.warnings,
      ],
      templateType,
      totalPiiTokensRemoved,
      userId: user.id,
    });

    logRouteInfo(context, "Blocked AI output after post-generation validation.", {
      blockingReasonCount: outputGuardResult.blockingReasons.length,
      outputPlaceholderCount: outputGuardResult.outputPlaceholders.length,
      requiredPlaceholderCount: outputGuardResult.requiredPlaceholders.length,
      warningCount: outputGuardResult.warnings.length,
    });

    return jsonWithContext(
      {
        error: "AI-svaret stoppades eftersom det kan innehålla personuppgifter eller nya elevmarkörer. Försök igen med tydligare avidentifierat underlag.",
        code: "OUTPUT_GUARD_BLOCKED",
      },
      { status: 502 },
      context,
    );
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

  const responseHeaders = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-Skolskribenten-Output-Guard": "passed",
  });
  const serializedWarnings = serializeOutputGuardWarnings(outputGuardResult.warnings);

  if (serializedWarnings) {
    responseHeaders.set("X-Skolskribenten-Output-Warnings", serializedWarnings);
  }

  return withRequestContext(
    new Response(generatedText, {
      headers: responseHeaders,
    }),
    context,
  );
}
