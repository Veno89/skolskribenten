import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { MissingProfileState } from "@/components/dashboard/MissingProfileState";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";
import { isCurrentUserSupportAdmin } from "@/lib/support/admin-server";

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile();

  if (!profile) {
    return <MissingProfileState />;
  }

  const isSupportAdmin = await isCurrentUserSupportAdmin(profile.id);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ss-neutral-50)]">
      <DashboardNav profile={profile} isSupportAdmin={isSupportAdmin} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
