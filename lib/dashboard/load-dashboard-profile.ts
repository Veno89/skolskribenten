import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

interface LoadDashboardProfileOptions {
  nextPath?: string;
}

interface DashboardProfileResult {
  profile: Profile | null;
  user: {
    email?: string;
    id: string;
  };
}

export async function loadDashboardProfile(
  options: LoadDashboardProfileOptions = {},
): Promise<DashboardProfileResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginPath = options.nextPath
      ? `/logga-in?next=${encodeURIComponent(options.nextPath)}`
      : "/logga-in";

    redirect(loginPath);
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return {
    profile: (profile as Profile | null) ?? null,
    user: {
      email: user.email,
      id: user.id,
    },
  };
}
