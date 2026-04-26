import { NextRequest } from "next/server";
import {
  createRouteContext,
  jsonWithContext,
  logRouteError,
  logRouteInfo,
} from "@/lib/server/request-context";
import { queueOperationalInfoAlert } from "@/lib/server/operational-alerts";
import {
  getSupportRateLimitWindowStart,
  hasExceededSupportRateLimit,
  isDuplicateSupportRequest,
  isSupportHoneypotTriggered,
} from "@/lib/support/abuse-protection";
import {
  detectSupportSensitiveContent,
  formatSupportSensitiveContentMessage,
  hashSupportEmail,
  summarizeSupportSensitiveContentTypes,
} from "@/lib/support/server-privacy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SupportRequestSchema } from "@/lib/support/schema";

const SUCCESS_MESSAGE = "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg.";
const RATE_LIMIT_MESSAGE =
  "Du har skickat flera meddelanden på kort tid. Vänta gärna en stund innan du försöker igen.";

function buildSuccessResponse(context: ReturnType<typeof createRouteContext>): Response {
  return jsonWithContext(
    { ok: true, message: SUCCESS_MESSAGE },
    { status: 200 },
    context,
  );
}

function getHoneypotValue(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  return (body as Record<string, unknown>).website;
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "support");
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonWithContext({ error: "Ogiltig förfrågan." }, { status: 400 }, context);
  }

  if (isSupportHoneypotTriggered(getHoneypotValue(body))) {
    logRouteInfo(context, "Suppressed honeypot support submission.");
    return buildSuccessResponse(context);
  }

  const parsed = SupportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonWithContext(
      { error: parsed.error.issues[0]?.message ?? "Ogiltig förfrågan." },
      { status: 400 },
      context,
    );
  }

  const sensitiveContentFindings = detectSupportSensitiveContent(parsed.data.message);

  if (sensitiveContentFindings.length > 0) {
    logRouteInfo(context, "Rejected support submission with sensitive content.", {
      sensitiveContentTypes: summarizeSupportSensitiveContentTypes(sensitiveContentFindings),
    });

    return jsonWithContext(
      { error: formatSupportSensitiveContentMessage(sensitiveContentFindings) },
      { status: 400 },
      context,
    );
  }

  let userId: string | null = null;
  const emailHash = hashSupportEmail(parsed.data.email);

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const adminSupabase = createAdminClient();
    const { data: recentRequests, error: recentRequestsError } = await adminSupabase
      .from("support_requests")
      .select("message, created_at")
      .eq("email", parsed.data.email)
      .gte("created_at", getSupportRateLimitWindowStart());

    if (recentRequestsError) {
      logRouteError(context, "Failed to read recent support requests.", recentRequestsError);
    } else if (recentRequests) {
      if (isDuplicateSupportRequest(recentRequests, parsed.data.message)) {
        logRouteInfo(context, "Suppressed duplicate support submission.", {
          emailHash,
        });
        return buildSuccessResponse(context);
      }

      if (hasExceededSupportRateLimit(recentRequests)) {
        logRouteInfo(context, "Support rate limit reached.", {
          emailHash,
          recentRequestCount: recentRequests.length,
        });
        return jsonWithContext({ error: RATE_LIMIT_MESSAGE }, { status: 429 }, context);
      }
    }

    const { error } = await adminSupabase.from("support_requests").insert({
      email: parsed.data.email,
      message: parsed.data.message,
      name: parsed.data.name,
      request_id: context.requestId,
      role: parsed.data.role ?? null,
      status: "new",
      topic: parsed.data.topic,
      user_id: userId,
    });

    if (error) {
      logRouteError(context, "Failed to store support request.", error);
      return jsonWithContext(
        { error: "Vi kunde inte ta emot meddelandet just nu. Försök igen om en stund." },
        { status: 500 },
        context,
      );
    }

    queueOperationalInfoAlert(context, "New support request received.", {
      supportRequestId: context.requestId,
      topic: parsed.data.topic,
      userId: userId ?? "anonymous",
    });
  } catch (error) {
    logRouteError(context, "Failed to create support request.", error);
    return jsonWithContext(
      { error: "Vi kunde inte ta emot meddelandet just nu. Försök igen om en stund." },
      { status: 500 },
      context,
    );
  }

  return buildSuccessResponse(context);
}
