import type { Metadata } from "next";
import { SettingsPageContent } from "@/components/dashboard/settings/SettingsPageContent";
import {
  getNoticeFromSearchParams,
  type AuthSearchParams,
} from "@/lib/auth/redirects";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export const metadata: Metadata = {
  title: "InstÃ¤llningar",
  description: "Anpassa skolnivÃ¥, ton och kontoinformation fÃ¶r dina AI-utkast.",
};

interface Props {
  searchParams?: AuthSearchParams;
}

export default async function InstallningarPage({ searchParams }: Props): Promise<JSX.Element | null> {
  const { profile, user } = await loadDashboardProfile({ nextPath: "/installningar" });

  if (!profile) return null;

  return (
    <SettingsPageContent
      notice={getNoticeFromSearchParams(searchParams)}
      profile={profile}
      userEmail={user.email}
    />
  );
}
