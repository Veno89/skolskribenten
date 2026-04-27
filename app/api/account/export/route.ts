import { NextRequest } from "next/server";
import {
  createRouteContext,
  jsonWithContext,
  logRouteError,
  withRequestContext,
} from "@/lib/server/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadAccountExport(admin: AdminClient, userId: string) {
  const [
    profile,
    entitlements,
    customerMappings,
    checkoutSessions,
    subscriptions,
    planningChecklists,
    supportRequests,
    usageEvents,
    deletionRequests,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id,email,full_name,school_name,subscription_status,subscription_end_date,transforms_used_this_month,transforms_reset_at,created_at,updated_at,user_settings",
      )
      .eq("id", userId)
      .maybeSingle(),
    admin.from("account_entitlements").select("*").eq("user_id", userId),
    admin.from("stripe_customer_mappings").select("*").eq("user_id", userId),
    admin
      .from("stripe_checkout_sessions")
      .select(
        "id,stripe_checkout_session_id,stripe_customer_id,stripe_subscription_id,mode,price_key,status,payment_status,created_at,updated_at,latest_event_created_at",
      )
      .eq("user_id", userId),
    admin
      .from("stripe_subscriptions")
      .select(
        "id,stripe_subscription_id,stripe_customer_id,stripe_price_id,stripe_status,current_period_end,cancel_at_period_end,created_at,updated_at,latest_event_created_at,last_reconciled_at",
      )
      .eq("user_id", userId),
    admin
      .from("planning_checklists")
      .select("id,subject_id,area_id,progress_map,teacher_notes,revision,created_at,updated_at,client_updated_at")
      .eq("user_id", userId),
    admin
      .from("support_requests")
      .select(
        "id,request_id,topic,status,role,message,created_at,last_status_at,handled_at,redacted_at,deleted_at",
      )
      .eq("user_id", userId),
    admin
      .from("usage_events")
      .select(
        "id,created_at,template_type,scrubber_ran,pii_tokens_removed,client_reported_pii_tokens_removed,server_pii_check_passed,ai_provider,ai_model,prompt_version,output_guard_version,output_guard_passed,output_guard_warnings",
      )
      .eq("user_id", userId),
    admin.from("account_deletion_requests").select("*").eq("user_id", userId),
  ]);

  const firstError =
    profile.error ??
    entitlements.error ??
    customerMappings.error ??
    checkoutSessions.error ??
    subscriptions.error ??
    planningChecklists.error ??
    supportRequests.error ??
    usageEvents.error ??
    deletionRequests.error ??
    null;

  if (firstError) {
    throw firstError;
  }

  return {
    exportedAt: new Date().toISOString(),
    exportFormatVersion: "skolskribenten-account-export-2026-04-27-v1",
    userId,
    profile: profile.data,
    billing: {
      checkoutSessions: checkoutSessions.data ?? [],
      customerMappings: customerMappings.data ?? [],
      entitlements: entitlements.data ?? [],
      subscriptions: subscriptions.data ?? [],
    },
    deletionRequests: deletionRequests.data ?? [],
    planningChecklists: planningChecklists.data ?? [],
    supportRequests: supportRequests.data ?? [],
    usageEvents: usageEvents.data ?? [],
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "account.export");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonWithContext(
      { error: "Du behöver logga in för att exportera kontodata." },
      { status: 401 },
      context,
    );
  }

  let admin: AdminClient;

  try {
    admin = createAdminClient();
  } catch (error) {
    logRouteError(context, "Failed to create admin client for account export.", error);
    return jsonWithContext(
      { error: "Kontodata kan inte exporteras innan serverkonfigurationen är klar." },
      { status: 500 },
      context,
    );
  }

  try {
    const payload = await loadAccountExport(admin, user.id);
    const body = JSON.stringify(payload, null, 2);

    return withRequestContext(
      new Response(body, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Disposition": `attachment; filename="skolskribenten-account-export-${user.id}.json"`,
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      }),
      context,
    );
  } catch (error) {
    logRouteError(context, "Failed to export account data.", error);
    return jsonWithContext(
      { error: "Kunde inte exportera kontodata just nu." },
      { status: 500 },
      context,
    );
  }
}
