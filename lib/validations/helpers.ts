import type { ZodError } from "zod";

export function getFirstIssue(
  error: ZodError<unknown>,
  fallback = "Kontrollera formuläret och försök igen."
): string {
  return error.issues[0]?.message ?? fallback;
}

export function getValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
