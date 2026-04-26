import {
  detectPotentialSensitiveContent,
  type PotentialSensitiveContentFinding,
} from "@/lib/gdpr/server-guard";

const PERSON_PLACEHOLDER_PATTERN = /\[(?:Elev|Personal)\s+\d+\]/giu;
const STRUCTURAL_PLACEHOLDER_PATTERN = /\[(?:personnummer|samordningsnummer|e-postadress|telefonnummer)\]/giu;
const BLOCKING_SENSITIVE_TYPES = new Set<PotentialSensitiveContentFinding["type"]>([
  "email",
  "known_name",
  "personnummer",
  "phone",
  "samordningsnummer",
]);

export interface AiOutputGuardResult {
  blockingReasons: string[];
  outputPlaceholders: string[];
  passed: boolean;
  requiredPlaceholders: string[];
  warnings: string[];
}

function normalizePlaceholder(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractAiPlaceholders(text: string): string[] {
  const matches = [
    ...Array.from(text.matchAll(PERSON_PLACEHOLDER_PATTERN), (match) => match[0]),
    ...Array.from(text.matchAll(STRUCTURAL_PLACEHOLDER_PATTERN), (match) => match[0]),
  ];

  return Array.from(new Set(matches.map(normalizePlaceholder)));
}

function isPersonPlaceholder(value: string): boolean {
  return /^\[(?:Elev|Personal)\s+\d+\]$/iu.test(value);
}

function getFindingType(finding: unknown): PotentialSensitiveContentFinding["type"] | null {
  if (!finding || typeof finding !== "object") {
    return null;
  }

  const type = (finding as Partial<PotentialSensitiveContentFinding>).type;
  return typeof type === "string" ? (type as PotentialSensitiveContentFinding["type"]) : null;
}

export function validateAiOutput(params: {
  inputText: string;
  outputText: string;
}): AiOutputGuardResult {
  const requiredPlaceholders = extractAiPlaceholders(params.inputText);
  const outputPlaceholders = extractAiPlaceholders(params.outputText);
  const outputPlaceholderSet = new Set(outputPlaceholders);
  const requiredPlaceholderSet = new Set(requiredPlaceholders);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const missingPlaceholders = requiredPlaceholders.filter((placeholder) => !outputPlaceholderSet.has(placeholder));
  if (missingPlaceholders.length > 0) {
    warnings.push(`Output saknar placeholder från input: ${missingPlaceholders.join(", ")}`);
  }

  const introducedPersonPlaceholders = outputPlaceholders.filter(
    (placeholder) => isPersonPlaceholder(placeholder) && !requiredPlaceholderSet.has(placeholder),
  );
  if (introducedPersonPlaceholders.length > 0) {
    blockingReasons.push(`Output introducerade ny person-placeholder: ${introducedPersonPlaceholders.join(", ")}`);
  }

  const sensitiveFindings = detectPotentialSensitiveContent(params.outputText);
  const blockingSensitiveTypes = Array.from(
    new Set(
      sensitiveFindings
        .map(getFindingType)
        .filter((type): type is PotentialSensitiveContentFinding["type"] => Boolean(type))
        .filter((type) => BLOCKING_SENSITIVE_TYPES.has(type)),
    ),
  );

  if (blockingSensitiveTypes.length > 0) {
    blockingReasons.push(`Output verkar innehålla personuppgifter: ${blockingSensitiveTypes.join(", ")}`);
  }

  if (sensitiveFindings.some((finding) => getFindingType(finding) === "capitalized_word")) {
    warnings.push("Output innehåller ord som bör granskas eftersom de kan likna namn.");
  }

  return {
    blockingReasons,
    outputPlaceholders,
    passed: blockingReasons.length === 0,
    requiredPlaceholders,
    warnings,
  };
}

export function serializeOutputGuardWarnings(warnings: string[]): string | null {
  if (warnings.length === 0) {
    return null;
  }

  return JSON.stringify(warnings.slice(0, 5));
}
