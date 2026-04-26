import {
  getAppAdminContext,
  isCurrentUserAppAdmin,
  type AppAdminContext,
} from "@/lib/admin/server";

export type SupportAdminContext = AppAdminContext;

export async function getSupportAdminContext(
  nextPath = "/admin/support",
): Promise<SupportAdminContext | null> {
  return getAppAdminContext(nextPath);
}

export async function isCurrentUserSupportAdmin(userId: string): Promise<boolean> {
  return isCurrentUserAppAdmin(userId);
}
