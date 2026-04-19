import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CLAUDE_PRIMARY_MODEL, TEMPLATE_TYPES, resolveProvider } from "@/lib/ai/provider";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { parseUserSettings } from "@/lib/validations/user-settings";

const RequestSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  scrubbedInput: z.string().min(10).max(5000),
  scrubberStats: z.object({
    namesReplaced: z.number(),
    piiTokensReplaced: z.number(),
  }),
});

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ allowed: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("api_call_count, api_call_window_start")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { allowed: false };
  }

  const windowStart = new Date(profile.api_call_window_start);
  const now = new Date();
  const windowSeconds = 60;
  const maxCallsPerWindow = 10;
  const windowExpired =
    now.getTime() - windowStart.getTime() > windowSeconds * 1000;

  if (windowExpired) {
    await supabase
      .from("profiles")
      .update({
        api_call_count: 1,
        api_call_window_start: now.toISOString(),
      })
      .eq("id", userId);

    return { allowed: true };
  }

  if (profile.api_call_count >= maxCallsPerWindow) {
    return { allowed: false };
  }

  await supabase
    .from("profiles")
    .update({ api_call_count: profile.api_call_count + 1 })
    .eq("id", userId);

  return { allowed: true };
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Du behöver logga in för att fortsätta." }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(supabase, user.id);

  if (!allowed) {
    return NextResponse.json(
      { error: "För många förfrågningar. Vänta en stund och försök igen." },
      { status: 429 },
    );
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, transforms_used_this_month, subscription_end_date, user_settings")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil hittades inte" }, { status: 404 });
  }

  const isPro =
    profile.subscription_status === "pro" &&
    (profile.subscription_end_date === null ||
      new Date(profile.subscription_end_date) > new Date());

  const freeLimit = 10;

  if (!isPro && profile.transforms_used_this_month >= freeLimit) {
    return NextResponse.json(
      { error: "Månadens gratisgräns nådd", code: "QUOTA_EXCEEDED" },
      { status: 403 },
    );
  }

  const provider = resolveProvider();

  if (provider !== "claude") {
    return NextResponse.json(
      { error: "Konfigurerad AI-leverantör stöds inte ännu." },
      { status: 500 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI-tjänsten är inte konfigurerad." },
      { status: 500 },
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { templateType, scrubbedInput, scrubberStats } = parsed.data;
  const encoder = new TextEncoder();
  const userSettings = parseUserSettings(profile.user_settings);
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

        await supabase.from("usage_events").insert({
          user_id: user.id,
          template_type: templateType,
          scrubber_ran: true,
          pii_tokens_removed:
            scrubberStats.namesReplaced + scrubberStats.piiTokensReplaced,
        });

        await supabase
          .from("profiles")
          .update({
            transforms_used_this_month: profile.transforms_used_this_month + 1,
          })
          .eq("id", user.id);

        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Okänt fel vid generering";
        console.error("[AI Route] Generation failed:", message);
        controller.error(error);
      }
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
