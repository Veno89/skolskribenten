import type { Metadata } from "next";
import { PlanningWorkspaceLoader } from "@/components/planning/PlanningWorkspaceLoader";
import { getAuthoritativeEntitlementDecision } from "@/lib/billing/entitlements";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lektionsplanering",
  description: "Planera undervisning, följ checklista för centralt innehåll och hitta luckor.",
};

export default async function LektionsplaneringPage(): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/lektionsplanering" });
  const supabase = createClient();
  const { data: entitlement } = await supabase
    .from("account_entitlements")
    .select("access_level, source, reason, paid_access_until")
    .eq("user_id", profile!.id)
    .maybeSingle();
  const cloudSyncEnabled = getAuthoritativeEntitlementDecision(entitlement).active;

  return <PlanningWorkspaceLoader userId={profile!.id} cloudSyncEnabled={cloudSyncEnabled} />;
}
