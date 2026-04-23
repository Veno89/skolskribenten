export const TEMPLATE_TYPES = [
  "incidentrapport",
  "larlogg",
  "unikum",
  "veckobrev",
  "custom",
  "lektionsplanering",
] as const;

export const SCHOOL_LEVELS = ["F-3", "4-6", "7-9"] as const;
export const PREFERRED_TONES = ["formal", "warm"] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];
export type PreferredTone = (typeof PREFERRED_TONES)[number];

export interface GenerateDocumentParams {
  templateType: TemplateType;
  scrubbedInput: string;
  userSettings?: {
    schoolLevel?: SchoolLevel;
    preferredTone?: PreferredTone;
  };
}

// Verified against Anthropic's official models overview on April 18, 2026.
export const CLAUDE_PRIMARY_MODEL = "claude-sonnet-4-6";
