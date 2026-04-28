import type { ReactNode } from "react";
import { DashboardErrorBoundary } from "@/components/dashboard/DashboardErrorBoundary";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { MissingProfileState } from "@/components/dashboard/MissingProfileState";
import { isCurrentUserAppAdmin } from "@/lib/admin/server";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

interface Props {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: Props): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile();

  if (!profile) {
    return <MissingProfileState />;
  }

  const isAppAdmin = await isCurrentUserAppAdmin(profile.id);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ss-neutral-50)]">
      <DashboardNav profile={profile} isAppAdmin={isAppAdmin} />
      <div className="flex-1">
        <DashboardErrorBoundary>{children}</DashboardErrorBoundary>
      </div>
    </div>
  );
}
