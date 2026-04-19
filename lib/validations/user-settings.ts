import { PREFERRED_TONES, SCHOOL_LEVELS } from "@/lib/ai/provider";
import type { Json } from "@/types/database";
import { z } from "zod";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function emptyStringToUndefined(value: unknown): unknown {
  const trimmed = trimString(value);
  return trimmed === "" ? undefined : trimmed;
}

export const SCHOOL_LEVEL_LABELS = {
  "F-3": "F-3",
  "4-6": "4-6",
  "7-9": "7-9",
} as const;

export const TONE_LABELS = {
  formal: "Formell ton",
  warm: "Varm ton",
} as const;

export const UserSettingsSchema = z.object({
  schoolLevel: z.enum(SCHOOL_LEVELS).optional(),
  preferredTone: z.enum(PREFERRED_TONES).optional(),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UpdateProfileSettingsSchema = z.object({
  fullName: z.preprocess(
    trimString,
    z
      .string()
      .min(2, "Ange ditt namn.")
      .max(100, "Namnet får vara högst 100 tecken."),
  ),
  schoolName: z.preprocess(
    emptyStringToUndefined,
    z.string().max(120, "Skolnamnet får vara högst 120 tecken.").optional(),
  ),
  schoolLevel: z.preprocess(emptyStringToUndefined, z.enum(SCHOOL_LEVELS).optional()),
  preferredTone: z.preprocess(emptyStringToUndefined, z.enum(PREFERRED_TONES).optional()),
});

export type UpdateProfileSettingsInput = z.infer<typeof UpdateProfileSettingsSchema>;

export function parseUserSettings(value: Json | null | undefined): UserSettings {
  const parsed = UserSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function buildUserSettings(
  input: Pick<UpdateProfileSettingsInput, "schoolLevel" | "preferredTone">,
): UserSettings {
  return UserSettingsSchema.parse({
    schoolLevel: input.schoolLevel,
    preferredTone: input.preferredTone,
  });
}
