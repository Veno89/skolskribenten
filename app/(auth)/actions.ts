"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildPath,
  DEFAULT_POST_AUTH_REDIRECT,
  sanitizeNextPath,
} from "@/lib/auth/redirects";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  PasswordSchema,
} from "@/lib/auth/password-policy";
import { getAppUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getFirstIssue } from "@/lib/validations/helpers";

const EmailSchema = z.string().trim().email("Ange en giltig e-postadress.");

const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Ange ditt lösenord."),
  next: z.string().optional(),
});

const SignUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Ange ditt namn.").max(80, "Namnet är för långt."),
    schoolName: z.string().trim().max(120, "Skolans namn är för långt."),
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Bekräfta lösenordet."),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lösenorden matchar inte.",
    path: ["confirmPassword"],
  });

const RequestResetSchema = z.object({
  email: EmailSchema,
});

const ResendConfirmationSchema = z.object({
  email: EmailSchema,
  next: z.string().optional(),
});

const UpdatePasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1, "Bekräfta lösenordet."),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lösenorden matchar inte.",
    path: ["confirmPassword"],
  });

function getValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toFriendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Fel e-postadress eller lösenord.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Bekräfta din e-postadress innan du loggar in.";
  }

  if (normalized.includes("password")) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (normalized.includes("rate limit")) {
    return "För många försök på kort tid. Vänta en stund och prova igen.";
  }

  return "Något gick inte som väntat. Försök igen.";
}

function redirectWithMessage(
  pathname: string,
  params: Record<string, string | undefined>,
): never {
  redirect(buildPath(pathname, params));
}

export async function loginAction(formData: FormData): Promise<never> {
  const parsed = SignInSchema.safeParse({
    email: getValue(formData, "email"),
    password: getValue(formData, "password"),
    next: getValue(formData, "next"),
  });

  const next = sanitizeNextPath(getValue(formData, "next"), DEFAULT_POST_AUTH_REDIRECT);

  if (!parsed.success) {
    redirectWithMessage("/logga-in", { error: getFirstIssue(parsed.error), next });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const isUnconfirmedEmail = error.message.toLowerCase().includes("email not confirmed");

    redirectWithMessage("/logga-in", {
      error: toFriendlyAuthError(error.message),
      next,
      resendEmail: isUnconfirmedEmail ? parsed.data.email : undefined,
    });
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function registerAction(formData: FormData): Promise<never> {
  const rawNext = getValue(formData, "next");
  const next = sanitizeNextPath(rawNext, DEFAULT_POST_AUTH_REDIRECT);
  const parsed = SignUpSchema.safeParse({
    fullName: getValue(formData, "fullName"),
    schoolName: getValue(formData, "schoolName"),
    email: getValue(formData, "email"),
    password: getValue(formData, "password"),
    confirmPassword: getValue(formData, "confirmPassword"),
    next: rawNext,
  });

  if (!parsed.success) {
    redirectWithMessage("/registrera", { error: getFirstIssue(parsed.error), next });
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        school_name: parsed.data.schoolName || undefined,
      },
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("user already registered")) {
      redirectWithMessage("/logga-in", {
        success: "Om adressen kan användas har vi skickat instruktioner. Annars kan du logga in eller återställa lösenordet.",
        next,
      });
    }

    redirectWithMessage("/registrera", { error: toFriendlyAuthError(error.message), next });
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect(next);
  }

  redirectWithMessage("/logga-in", {
    success: "Kontot är skapat. Bekräfta din e-postadress och logga sedan in.",
    next,
    resendEmail: parsed.data.email,
  });
}

export async function resendConfirmationAction(formData: FormData): Promise<never> {
  const parsed = ResendConfirmationSchema.safeParse({
    email: getValue(formData, "email"),
    next: getValue(formData, "next"),
  });

  const next = sanitizeNextPath(getValue(formData, "next"), DEFAULT_POST_AUTH_REDIRECT);

  if (!parsed.success) {
    redirectWithMessage("/logga-in", { error: getFirstIssue(parsed.error), next });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirectWithMessage("/logga-in", {
      error: toFriendlyAuthError(error.message),
      next,
      resendEmail: parsed.data.email,
    });
  }

  redirectWithMessage("/logga-in", {
    info: "Vi har skickat en ny bekräftelselänk. Kontrollera inkorgen och skräpposten.",
    next,
    resendEmail: parsed.data.email,
  });
}

export async function requestPasswordResetAction(formData: FormData): Promise<never> {
  const parsed = RequestResetSchema.safeParse({
    email: getValue(formData, "email"),
  });

  if (!parsed.success) {
    redirectWithMessage("/aterstall", { error: getFirstIssue(parsed.error) });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/confirm?next=${encodeURIComponent("/aterstall?mode=update")}`,
  });

  if (error) {
    redirectWithMessage("/aterstall", { error: toFriendlyAuthError(error.message) });
  }

  redirectWithMessage("/aterstall", {
    success: "Om adressen finns registrerad har vi skickat en återställningslänk.",
  });
}

export async function updatePasswordAction(formData: FormData): Promise<never> {
  const rawNext = getValue(formData, "next");
  const next = sanitizeNextPath(rawNext, DEFAULT_POST_AUTH_REDIRECT);
  const parsed = UpdatePasswordSchema.safeParse({
    password: getValue(formData, "password"),
    confirmPassword: getValue(formData, "confirmPassword"),
    next: rawNext,
  });

  if (!parsed.success) {
    redirectWithMessage("/aterstall", {
      error: getFirstIssue(parsed.error),
      mode: "update",
      next,
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/aterstall", {
      error: "Återställningslänken har löpt ut. Be om en ny länk.",
    });
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirectWithMessage("/aterstall", {
      error: toFriendlyAuthError(error.message),
      mode: "update",
      next,
    });
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOutAction(): Promise<never> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(buildPath("/logga-in", { success: "Du har loggats ut." }));
}
