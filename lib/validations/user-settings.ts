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

const SAFE_CAPITALIZED_WORD_MAX_LENGTH = 40;
const SAFE_CAPITALIZED_WORDS_MAX_COUNT = 80;

const SafeCapitalizedWordSchema = z
  .string()
  .trim()
  .min(2, "Ange minst två tecken per säkert versalord.")
  .max(
    SAFE_CAPITALIZED_WORD_MAX_LENGTH,
    `Säkra versalord får vara högst ${SAFE_CAPITALIZED_WORD_MAX_LENGTH} tecken.`,
  )
  .regex(
    /^\p{Lu}[\p{L}\p{M}\d'-]*$/u,
    "Säkra versalord måste börja med versal och får bara innehålla bokstäver, siffror, bindestreck eller apostrof.",
  );

function splitSafeCapitalizedWords(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(/[\n,;]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function normalizeSafeCapitalizedWords(words: string[] | undefined): string[] | undefined {
  if (!words) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized = words.filter((word) => {
    const key = word.toLocaleLowerCase("sv-SE");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return normalized.length > 0 ? normalized : undefined;
}

const SafeCapitalizedWordsSchema = z
  .array(SafeCapitalizedWordSchema)
  .max(
    SAFE_CAPITALIZED_WORDS_MAX_COUNT,
    `Du kan spara högst ${SAFE_CAPITALIZED_WORDS_MAX_COUNT} säkra versalord.`,
  )
  .transform(normalizeSafeCapitalizedWords)
  .optional();

export const UserSettingsSchema = z.object({
  schoolLevel: z.enum(SCHOOL_LEVELS).optional(),
  preferredTone: z.enum(PREFERRED_TONES).optional(),
  safeCapitalizedWords: SafeCapitalizedWordsSchema,
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
  safeCapitalizedWords: z.preprocess(splitSafeCapitalizedWords, SafeCapitalizedWordsSchema),
});

export type UpdateProfileSettingsInput = z.infer<typeof UpdateProfileSettingsSchema>;

export function parseUserSettings(value: Json | null | undefined): UserSettings {
  const parsed = UserSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export function buildUserSettings(
  input: Pick<
    UpdateProfileSettingsInput,
    "preferredTone" | "safeCapitalizedWords" | "schoolLevel"
  >,
): UserSettings {
  const settings = UserSettingsSchema.parse({
    schoolLevel: input.schoolLevel,
    preferredTone: input.preferredTone,
    safeCapitalizedWords: input.safeCapitalizedWords,
  });

  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined),
  ) as UserSettings;
}
