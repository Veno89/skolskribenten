import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLAUDE_PRIMARY_MODEL, TEMPLATE_TYPES } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { FREE_TRANSFORM_LIMIT } from "@/lib/billing/entitlements";
import {
  detectPotentialSensitiveContent,
  formatPotentialSensitiveContentMessage,
} from "@/lib/gdpr/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseUserSettings } from "@/lib/validations/user-settings";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_CALLS_PER_WINDOW = 10;

const RequestSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  scrubbedInput: z.string().min(10).max(5000),
  scrubberStats: z.object({
    namesReplaced: z.number().int().min(0).max(5000),
    piiTokensReplaced: z.number().int().min(0).max(5000),
  }),
});

function buildAttemptFailureResponse(reason: string): Response {
  switch (reason) {
    case "profile_not_found":
      return NextResponse.json({ error: "Profil hittades inte" }, { status: 404 });
    case "quota_exceeded":
      return NextResponse.json(
        { error: "Månadens gratisgräns nådd", code: "QUOTA_EXCEEDED" },
        { status: 403 },
      );
    case "rate_limited":
      return NextResponse.json(
        { error: "För många förfrågningar. Vänta en stund och försök igen." },
        { status: 429 },
      );
    default:
      return NextResponse.json(
        { error: "Kunde inte starta genereringen just nu." },
        { status: 500 },
      );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Du behöver logga in för att fortsätta." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-tjänsten är inte konfigurerad." },
      { status: 500 },
    );
  }

  const { scrubbedInput, scrubberStats, templateType } = parsed.data;
  const potentialSensitiveContent = detectPotentialSensitiveContent(scrubbedInput);

  if (potentialSensitiveContent.length > 0) {
    return NextResponse.json(
      { error: formatPotentialSensitiveContentMessage(potentialSensitiveContent) },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: generationAttempt, error: generationAttemptError } = await adminSupabase
    .rpc("begin_generation_attempt", {
      p_user_id: user.id,
      p_free_limit: FREE_TRANSFORM_LIMIT,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_calls_per_window: MAX_CALLS_PER_WINDOW,
    })
    .maybeSingle();

  if (generationAttemptError || !generationAttempt) {
    return NextResponse.json(
      { error: "Kunde inte starta genereringen just nu." },
      { status: 500 },
    );
  }

  if (!generationAttempt.allowed) {
    return buildAttemptFailureResponse(generationAttempt.reason);
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  const reservedTransform = generationAttempt.reserved_transform;
  const clientReportedPiiTokensRemoved =
    scrubberStats.namesReplaced + scrubberStats.piiTokensReplaced;
  const userSettings = parseUserSettings(generationAttempt.user_settings);
  const systemPrompt = getSystemPrompt(templateType, { userSettings });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const claudeStream = await anthropic.messages.stream({
          model: CLAUDE_PRIMARY_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Här är lärarens anteckningar (all personinformation är borttagen av GDPR-skölden):\n\n${scrubbedInput}`,
            },
          ],
        });

        for await (const chunk of claudeStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (error) {
        if (reservedTransform) {
          const { error: releaseError } = await adminSupabase.rpc("release_generation_attempt", {
            p_user_id: user.id,
          });

          if (releaseError) {
            console.error("[AI Route] Failed to release reserved transform:", releaseError.message);
          }
        }

        const message = error instanceof Error ? error.message : "Okänt fel vid generering";
        console.error("[AI Route] Generation failed:", message);
        controller.error(error);
        return;
      }

      const { error: usageError } = await adminSupabase.from("usage_events").insert({
        user_id: user.id,
        template_type: templateType,
        scrubber_ran: true,
        pii_tokens_removed: clientReportedPiiTokensRemoved,
        client_reported_pii_tokens_removed: clientReportedPiiTokensRemoved,
        server_pii_check_passed: true,
      });

      if (usageError) {
        console.error("[AI Route] Failed to record usage event:", usageError.message);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
