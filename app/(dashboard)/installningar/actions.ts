"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { getFirstIssue } from "@/lib/validations/helpers";
import {
  UpdateProfileSettingsSchema,
  buildUserSettings,
} from "@/lib/validations/user-settings";

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
