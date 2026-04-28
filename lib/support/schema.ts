import { z } from "zod";
import { normalizeSupportEmail } from "@/lib/support/abuse-protection";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function emptyStringToUndefined(value: unknown): unknown {
  const trimmed = trimString(value);
  return trimmed === "" ? undefined : trimmed;
}

export const SUPPORT_TOPICS = [
  "Allmän fråga",
  "Feedback från testning",
  "Tekniskt problem",
  "Pris eller abonnemang",
  "Samarbete eller demo",
] as const;

export const SupportRequestSchema = z.object({
  captchaToken: z.preprocess(
    emptyStringToUndefined,
    z.string().min(10, "Bot-skyddet saknar verifiering.").max(2048).optional(),
  ),
  email: z.preprocess(
    trimString,
    z
      .string()
      .email("Ange en giltig e-postadress.")
      .max(120, "E-postadressen är för lång.")
      .transform(normalizeSupportEmail),
  ),
  message: z.preprocess(
    trimString,
    z
      .string()
      .min(10, "Beskriv gärna ärendet med minst 10 tecken.")
      .max(5000, "Meddelandet får vara högst 5000 tecken."),
  ),
  name: z.preprocess(
    trimString,
    z.string().min(2, "Ange ditt namn.").max(80, "Namnet får vara högst 80 tecken."),
  ),
  role: z.preprocess(
    emptyStringToUndefined,
    z.string().max(120, "Roll eller skolform får vara högst 120 tecken.").optional(),
  ),
  topic: z.enum(SUPPORT_TOPICS),
});

export type SupportRequestInput = z.infer<typeof SupportRequestSchema>;
