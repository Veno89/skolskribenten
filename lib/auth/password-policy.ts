import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_REQUIREMENTS_TEXT =
  "Minst 12 tecken samt minst en versal, en gemen och en siffra.";

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Lösenordet måste vara minst 12 tecken och innehålla minst en versal, en gemen och en siffra.";

function meetsPasswordRequirements(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, "Lösenordet är för långt.")
  .refine(meetsPasswordRequirements, PASSWORD_REQUIREMENTS_MESSAGE);
