import type { Metadata } from "next";
import { DraftingStation } from "@/components/drafting/DraftingStation";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export const metadata: Metadata = {
  title: "Skrivstation",
  description: "Skriv pedagogisk dokumentation med GDPR-skydd och AI-stöd.",
};

export default async function SkrivstationPage(): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/skrivstation" });

  // Missing profile handled by layout.tsx
  return <DraftingStation userProfile={profile!} />;
}
