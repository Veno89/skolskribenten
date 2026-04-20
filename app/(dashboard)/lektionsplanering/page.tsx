import type { Metadata } from "next";
import { PlanningWorkspace } from "@/components/planning/PlanningWorkspace";
import { isActivePro } from "@/lib/billing/entitlements";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export const metadata: Metadata = {
  title: "Lektionsplanering",
  description: "Planera undervisning, följ checklista för centralt innehåll och hitta luckor.",
};

export default async function LektionsplaneringPage(): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/lektionsplanering" });
  const cloudSyncEnabled = isActivePro(profile!);

  return <PlanningWorkspace userId={profile!.id} cloudSyncEnabled={cloudSyncEnabled} />;
}
