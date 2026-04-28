"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildPath } from "@/lib/auth/redirects";
import { getAppUrl } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFirstIssue, getValue } from "@/lib/validations/helpers";
import {
  UpdateProfileSettingsSchema,
  buildUserSettings,
} from "@/lib/validations/user-settings";

const EmailSchema = z.string().trim().email("Ange en giltig e-postadress.");
const DeleteAccountRequestSchema = z.object({
  confirmation: z.string().trim(),
  reason: z.string().trim().max(1000, "Beskrivningen är för lång.").optional(),
});

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPath("/logga-in", { next: "/installningar" }));
  }

  const parsed = UpdateProfileSettingsSchema.safeParse({
    fullName: formData.get("fullName"),
    schoolName: formData.get("schoolName"),
    schoolLevel: formData.get("schoolLevel"),
    preferredTone: formData.get("preferredTone"),
  });

  if (!parsed.success) {
    redirect(
      buildPath("/installningar", {
        error: getFirstIssue(parsed.error),
      }),
    );
  }

  const { fullName, schoolName, schoolLevel, preferredTone } = parsed.data;
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      school_name: schoolName ?? null,
      user_settings: buildUserSettings({ schoolLevel, preferredTone }),
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    redirect(
      buildPath("/installningar", {
        error: "Kunde inte spara inställningarna just nu.",
      }),
    );
  }

  revalidatePath("/installningar");
  revalidatePath("/skrivstation");
  revalidatePath("/konto");

  redirect(
    buildPath("/installningar", {
      success: "Inställningarna sparades.",
    }),
  );
}

export async function updateEmailAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPath("/logga-in", { next: "/installningar" }));
  }

  const parsed = EmailSchema.safeParse(getValue(formData, "email"));

  if (!parsed.success) {
    redirect(buildPath("/installningar", { error: getFirstIssue(parsed.error) }));
  }

  if (parsed.data.toLowerCase() === (user.email ?? "").toLowerCase()) {
    redirect(buildPath("/installningar", { info: "E-postadressen är redan aktiv på kontot." }));
  }

  const { error } = await supabase.auth.updateUser(
    {
      email: parsed.data,
    },
    {
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=${encodeURIComponent("/installningar")}`,
    },
  );

  if (error) {
    redirect(
      buildPath("/installningar", {
        error: "Kunde inte starta e-postbytet just nu. Försök igen om en stund.",
      }),
    );
  }

  redirect(
    buildPath("/installningar", {
      success: "Bekräfta bytet via länken som skickats till den nya e-postadressen.",
    }),
  );
}

export async function requestAccountDeletionAction(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildPath("/logga-in", { next: "/installningar" }));
  }

  const parsed = DeleteAccountRequestSchema.safeParse({
    confirmation: getValue(formData, "confirmation"),
    reason: getValue(formData, "reason") || undefined,
  });

  if (!parsed.success) {
    redirect(buildPath("/installningar", { error: getFirstIssue(parsed.error) }));
  }

  if (parsed.data.confirmation !== "RADERA") {
    redirect(
      buildPath("/installningar", {
        error: "Skriv RADERA för att begära kontoradering.",
      }),
    );
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch {
    redirect(
      buildPath("/installningar", {
        error: "Kontoradering kan inte begäras innan serverkonfigurationen är klar.",
      }),
    );
  }

  const { data: existingRequest, error: existingError } = await adminSupabase
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["requested", "approved"])
    .maybeSingle();

  if (existingError) {
    redirect(
      buildPath("/installningar", {
        error: "Kunde inte kontrollera tidigare begäran om kontoradering.",
      }),
    );
  }

  if (existingRequest) {
    redirect(
      buildPath("/installningar", {
        info: "Det finns redan en öppen begäran om kontoradering.",
      }),
    );
  }

  const { error } = await adminSupabase.from("account_deletion_requests").insert({
    reason: parsed.data.reason ?? null,
    status: "requested",
    user_id: user.id,
  });

  if (error) {
    redirect(
      buildPath("/installningar", {
        error: "Kunde inte registrera begäran om kontoradering just nu.",
      }),
    );
  }

  redirect(
    buildPath("/installningar", {
      success: "Begäran om kontoradering är registrerad. Vi hanterar den via adminflödet.",
    }),
  );
}
