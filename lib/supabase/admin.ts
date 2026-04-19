import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseAdminKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createAdminClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAdminKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
