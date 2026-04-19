import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLAUDE_PRIMARY_MODEL, TEMPLATE_TYPES } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { FREE_TRANSFORM_LIMIT } from "@/lib/billing/entitlements";
import { GdprScrubber } from "@/lib/gdpr/scrubber";
import {
  detectPotentialSensitiveContent,
  formatPotentialSensitiveContentMessage,
} from "@/lib/gdpr/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseUserSettings } from "@/lib/validations/user-settings";
import type { Database } from "@/types/database";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_CALLS_PER_WINDOW = 10;
const serverScrubber = new GdprScrubber();

const RequestSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  scrubbedInput: z.string().min(10).max(5000),
  scrubberStats: z.object({
    namesReplaced: z.number().int().min(0).max(5000),
    piiTokensReplaced: z.number().int().min(0).max(5000),
  }),
});

type AdminClient = ReturnType<typeof createAdminClient>;
type GenerationAttemptResult =
  Database["public"]["Functions"]["begin_generation_attempt"]["Returns"][number];
type ProfileSnapshot = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "api_call_count"
  | "api_call_window_start"
  | "subscription_end_date"
  | "subscription_status"
  | "transforms_used_this_month"
  | "user_settings"
>;

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

function buildAttemptResult(
  profile: ProfileSnapshot | null,
  overrides: Partial<GenerationAttemptResult>,
): GenerationAttemptResult {
  return {
    allowed: false,
    reason: "profile_not_found",
    reserved_transform: false,
    subscription_status: profile?.subscription_status ?? null,
    subscription_end_date: profile?.subscription_end_date ?? null,
    transforms_used_this_month: profile?.transforms_used_this_month ?? null,
    user_settings: profile?.user_settings ?? {},
    ...overrides,
  };
}

function isActivePro(profile: Pick<ProfileSnapshot, "subscription_status" | "subscription_end_date">): boolean {
  const now = Date.now();

  return (
    profile.subscription_status === "pro" &&
    (profile.subscription_end_date === null ||
      new Date(profile.subscription_end_date).getTime() > now)
  );
}

function hasWindowExpired(windowStart: string, windowSeconds: number): boolean {
  const windowStartTimestamp = new Date(windowStart).getTime();

  if (Number.isNaN(windowStartTimestamp)) {
    return true;
  }

  return windowStartTimestamp < Date.now() - Math.max(windowSeconds, 1) * 1000;
}

async function beginGenerationAttemptFallback(
  adminSupabase: AdminClient,
  userId: string,
): Promise<GenerationAttemptResult | null> {
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select(
      "api_call_count, api_call_window_start, subscription_end_date, subscription_status, transforms_used_this_month, user_settings",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[AI Route] Fallback profile lookup failed:", profileError.message);
    return null;
  }

  if (!profile) {
    return buildAttemptResult(null, {
      reason: "profile_not_found",
    });
  }

  let apiCallCount = profile.api_call_count;
  let apiCallWindowStart = profile.api_call_window_start;

  if (hasWindowExpired(apiCallWindowStart, RATE_LIMIT_WINDOW_SECONDS)) {
    apiCallCount = 0;
    apiCallWindowStart = new Date().toISOString();

    const { error: resetError } = await adminSupabase
      .from("profiles")
      .update({
        api_call_count: apiCallCount,
        api_call_window_start: apiCallWindowStart,
      })
      .eq("id", userId);

    if (resetError) {
      console.error("[AI Route] Fallback rate-limit reset failed:", resetError.message);
      return null;
    }
  }

  if (apiCallCount >= Math.max(MAX_CALLS_PER_WINDOW, 1)) {
    return buildAttemptResult(profile, {
      reason: "rate_limited",
    });
  }

  const { error: countError } = await adminSupabase
    .from("profiles")
    .update({
      api_call_count: apiCallCount + 1,
    })
    .eq("id", userId);

  if (countError) {
    console.error("[AI Route] Fallback rate-limit increment failed:", countError.message);
    return null;
  }

  if (!isActivePro(profile)) {
    if (profile.transforms_used_this_month >= Math.max(FREE_TRANSFORM_LIMIT, 0)) {
      return buildAttemptResult(profile, {
        reason: "quota_exceeded",
      });
    }

    const nextTransformCount = profile.transforms_used_this_month + 1;
    const { error: transformError } = await adminSupabase
      .from("profiles")
      .update({
        transforms_used_this_month: nextTransformCount,
      })
      .eq("id", userId);

    if (transformError) {
      console.error("[AI Route] Fallback transform reservation failed:", transformError.message);
      return null;
    }

    return buildAttemptResult(profile, {
      allowed: true,
      reason: "allowed",
      reserved_transform: true,
      transforms_used_this_month: nextTransformCount,
    });
  }

  return buildAttemptResult(profile, {
    allowed: true,
    reason: "allowed",
    reserved_transform: false,
  });
}

async function beginGenerationAttempt(
  adminSupabase: AdminClient,
  userId: string,
): Promise<GenerationAttemptResult | null> {
  const { data, error } = await adminSupabase
    .rpc("begin_generation_attempt", {
      p_user_id: userId,
      p_free_limit: FREE_TRANSFORM_LIMIT,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_calls_per_window: MAX_CALLS_PER_WINDOW,
    })
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  if (error) {
    console.error("[AI Route] begin_generation_attempt RPC failed, using fallback:", error.message);
  } else {
    console.error("[AI Route] begin_generation_attempt RPC returned no data, using fallback.");
  }

  return beginGenerationAttemptFallback(adminSupabase, userId);
}

async function releaseGenerationAttempt(
  adminSupabase: AdminClient,
  userId: string,
): Promise<void> {
  const { error } = await adminSupabase.rpc("release_generation_attempt", {
    p_user_id: userId,
  });

  if (!error) {
    return;
  }

  console.error("[AI Route] release_generation_attempt RPC failed, using fallback:", error.message);

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("transforms_used_this_month")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    if (profileError) {
      console.error("[AI Route] Fallback release lookup failed:", profileError.message);
    }
    return;
  }

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({
      transforms_used_this_month: Math.max(profile.transforms_used_this_month - 1, 0),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("[AI Route] Fallback release update failed:", updateError.message);
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
  const serverScrubResult = serverScrubber.scrub(scrubbedInput);
  const effectiveScrubbedInput = serverScrubResult.scrubbedText;
  const potentialSensitiveContent = detectPotentialSensitiveContent(effectiveScrubbedInput);

  if (potentialSensitiveContent.length > 0) {
    return NextResponse.json(
      { error: formatPotentialSensitiveContentMessage(potentialSensitiveContent) },
      { status: 400 },
    );
  }

  let adminSupabase: AdminClient;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("[AI Route] Failed to create Supabase admin client:", error);
    return NextResponse.json(
      { error: "Genereringstjänsten saknar serverkonfiguration för Supabase." },
      { status: 500 },
    );
  }

  const generationAttempt = await beginGenerationAttempt(adminSupabase, user.id);

  if (!generationAttempt) {
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
  const serverAddedPiiTokensRemoved =
    serverScrubResult.stats.namesReplaced + serverScrubResult.stats.piiTokensReplaced;
  const totalPiiTokensRemoved = clientReportedPiiTokensRemoved + serverAddedPiiTokensRemoved;
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
              content: `Här är lärarens anteckningar (all personinformation är borttagen av GDPR-skölden):\n\n${effectiveScrubbedInput}`,
            },
          ],
        });

        for await (const chunk of claudeStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (error) {
        if (reservedTransform) {
          await releaseGenerationAttempt(adminSupabase, user.id);
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
        pii_tokens_removed: totalPiiTokensRemoved,
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
