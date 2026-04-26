import { redirect } from "next/navigation";
import { buildPath } from "@/lib/auth/redirects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface AppAdminContext {
  adminSupabase: ReturnType<typeof createAdminClient>;
  user: {
    email?: string;
    id: string;
  };
}

export async function getAppAdminContext(nextPath = "/admin/support"): Promise<AppAdminContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPath("/logga-in", { next: nextPath }));
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch {
    return null;
  }

  const { data: adminRow, error } = await adminSupabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !adminRow) {
    return null;
  }

  return {
    adminSupabase,
    user: {
      email: user.email,
      id: user.id,
    },
  };
}

export async function isCurrentUserAppAdmin(userId: string): Promise<boolean> {
  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch {
    return false;
  }

  const { data, error } = await adminSupabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}
