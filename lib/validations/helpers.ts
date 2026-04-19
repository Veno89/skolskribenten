import type { ZodError } from "zod";

export function getFirstIssue(
  error: ZodError<unknown>,
  fallback = "Kontrollera formuläret och försök igen."
): string {
  return error.issues[0]?.message ?? fallback;
}
