import { MissingProfileState } from "@/components/dashboard/MissingProfileState";
import { DraftingStation } from "@/components/drafting/DraftingStation";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export default async function SkrivstationPage(): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/skrivstation" });

  if (!profile) {
    return <MissingProfileState />;
  }

  return <DraftingStation userProfile={profile} />;
}
