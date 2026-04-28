import { getAiGovernanceMetadata } from "@/lib/ai/governance";
import { type TemplateType } from "@/lib/ai/provider";
import {
  FREE_TRANSFORM_LIMIT,
  PAID_TRANSFORM_LIMIT,
  getAuthoritativeEntitlementDecision,
  getMonthlyTransformLimit,
} from "@/lib/billing/entitlements";
import {
  createRouteContext,
  logRouteError,
} from "@/lib/server/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_CALLS_PER_WINDOW = 10;

type RouteContext = ReturnType<typeof createRouteContext>;
type AdminClient = ReturnType<typeof createAdminClient>;

export type GenerationAttemptResult =
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

type AccountEntitlementSnapshot = {
  access_level: "free" | "pro";
  paid_access_until: string | null;
  reason: string;
  source: "admin" | "none" | "one_time_pass" | "recurring_subscription";
};

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
  context: RouteContext,
): Promise<GenerationAttemptResult | null> {
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select(
      "api_call_count, api_call_window_start, subscription_end_date, subscription_status, transforms_used_this_month, user_settings",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    logRouteError(context, "Fallback profile lookup failed.", profileError);
    return null;
  }

  if (!profile) {
    return buildAttemptResult(null, {
      reason: "profile_not_found",
    });
  }

  const { data: entitlement, error: entitlementError } = await adminSupabase
    .from("account_entitlements")
    .select("access_level, source, reason, paid_access_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (entitlementError) {
    logRouteError(context, "Fallback authoritative entitlement lookup failed.", entitlementError);
    return buildAttemptResult(profile, {
      reason: "entitlement_check_failed",
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
      logRouteError(context, "Fallback rate-limit reset failed.", resetError);
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
    logRouteError(context, "Fallback rate-limit increment failed.", countError);
    return null;
  }

  const authoritativeDecision = getAuthoritativeEntitlementDecision(
    entitlement as AccountEntitlementSnapshot | null,
  );
  const entitlementProfile = {
    ...profile,
    subscription_end_date:
      authoritativeDecision.source === "one_time_pass" ? authoritativeDecision.paidAccessUntil : null,
    subscription_status: authoritativeDecision.active ? "pro" as const : "free" as const,
  };
  const monthlyTransformLimit = Math.max(getMonthlyTransformLimit(entitlementProfile), 0);

  if (profile.transforms_used_this_month >= monthlyTransformLimit) {
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
    logRouteError(context, "Fallback transform reservation failed.", transformError);
    return null;
  }

  return buildAttemptResult(profile, {
    allowed: true,
    reason: "allowed",
    reserved_transform: true,
    transforms_used_this_month: nextTransformCount,
  });
}

export async function beginGenerationAttempt(
  adminSupabase: AdminClient,
  userId: string,
  context: RouteContext,
): Promise<GenerationAttemptResult | null> {
  const { data, error } = await adminSupabase
    .rpc("begin_generation_attempt", {
      p_user_id: userId,
      p_free_limit: FREE_TRANSFORM_LIMIT,
      p_paid_limit: PAID_TRANSFORM_LIMIT,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_calls_per_window: MAX_CALLS_PER_WINDOW,
    })
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  if (error) {
    logRouteError(context, "begin_generation_attempt RPC failed, using fallback.", error);
  } else {
    logRouteError(context, "begin_generation_attempt RPC returned no data, using fallback.");
  }

  return beginGenerationAttemptFallback(adminSupabase, userId, context);
}

export async function releaseGenerationAttempt(
  adminSupabase: AdminClient,
  userId: string,
  context: RouteContext,
): Promise<void> {
  const { error } = await adminSupabase.rpc("release_generation_attempt", {
    p_user_id: userId,
  });

  if (!error) {
    return;
  }

  logRouteError(context, "release_generation_attempt RPC failed, using fallback.", error);

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("transforms_used_this_month")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    if (profileError) {
      logRouteError(context, "Fallback release lookup failed.", profileError);
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
    logRouteError(context, "Fallback release update failed.", updateError);
  }
}

export async function recordUsageEvent(params: {
  adminSupabase: AdminClient;
  clientReportedPiiTokensRemoved: number;
  context: RouteContext;
  governanceMetadata: ReturnType<typeof getAiGovernanceMetadata>;
  outputGuardPassed: boolean;
  outputGuardWarnings: string[];
  templateType: TemplateType;
  totalPiiTokensRemoved: number;
  userId: string;
}): Promise<void> {
  const { error } = await params.adminSupabase.from("usage_events").insert({
    ...params.governanceMetadata,
    user_id: params.userId,
    template_type: params.templateType,
    scrubber_ran: true,
    pii_tokens_removed: params.totalPiiTokensRemoved,
    client_reported_pii_tokens_removed: params.clientReportedPiiTokensRemoved,
    server_pii_check_passed: true,
    output_guard_passed: params.outputGuardPassed,
    output_guard_warnings: params.outputGuardWarnings.slice(0, 10),
  });

  if (error) {
    logRouteError(params.context, "Failed to record AI usage event.", error);
  }
}
