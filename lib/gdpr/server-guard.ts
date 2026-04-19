import { ALL_SWEDISH_NAMES, escapeRegex, SWEDISH_PATTERNS } from "./patterns";
import { collectLikelyUnknownNameWords } from "./scrubber";

const STRUCTURAL_MATCH_LIMIT = 3;
const NAME_MATCH_LIMIT = 5;
const CAPITALIZED_MATCH_LIMIT = 5;

export type PotentialSensitiveContentType =
  | "email"
  | "known_name"
  | "personnummer"
  | "phone"
  | "samordningsnummer"
  | "capitalized_word";

export interface PotentialSensitiveContentFinding {
  matches: string[];
  type: PotentialSensitiveContentType;
}

export function detectPotentialSensitiveContent(
  text: string,
): PotentialSensitiveContentFinding[] {
  const findings: PotentialSensitiveContentFinding[] = [];

  const structuralChecks: Array<{
    pattern: RegExp;
    type: Extract<
      PotentialSensitiveContentType,
      "email" | "personnummer" | "phone" | "samordningsnummer"
    >;
  }> = [
    { type: "personnummer", pattern: SWEDISH_PATTERNS.personnummer },
    { type: "samordningsnummer", pattern: SWEDISH_PATTERNS.samordningsnummer },
    { type: "phone", pattern: SWEDISH_PATTERNS.phone },
    { type: "email", pattern: SWEDISH_PATTERNS.email },
  ];

  structuralChecks.forEach(({ pattern, type }) => {
    const matches = getPatternMatches(text, pattern, STRUCTURAL_MATCH_LIMIT);

    if (matches.length > 0) {
      findings.push({ type, matches });
    }
  });

  const knownNameMatches = getKnownNameMatches(text, NAME_MATCH_LIMIT);

  if (knownNameMatches.length > 0) {
    findings.push({ type: "known_name", matches: knownNameMatches });
  }

  const capitalizedMatches = collectLikelyUnknownNameWords(text).slice(0, CAPITALIZED_MATCH_LIMIT);

  if (capitalizedMatches.length > 0) {
    findings.push({ type: "capitalized_word", matches: capitalizedMatches });
  }

  return findings;
}

export function formatPotentialSensitiveContentMessage(
  findings: PotentialSensitiveContentFinding[],
): string {
  const labels = Array.from(
    new Set(
      findings.map((finding) => {
        switch (finding.type) {
          case "email":
            return "e-postadress";
          case "known_name":
            return "namn";
          case "personnummer":
            return "personnummer";
          case "phone":
            return "telefonnummer";
          case "samordningsnummer":
            return "samordningsnummer";
          case "capitalized_word":
            return "ord som ser ut som namn";
        }
      }),
    ),
  );

  return `Texten verkar fortfarande innehålla personuppgifter (${labels.join(
    ", ",
  )}). Granska texten och försök igen.`;
}

function getPatternMatches(text: string, pattern: RegExp, limit: number): string[] {
  const matches = Array.from(
    text.matchAll(new RegExp(pattern.source, pattern.flags)),
    (match) => match[0],
  );

  return Array.from(new Set(matches)).slice(0, limit);
}

function getKnownNameMatches(text: string, limit: number): string[] {
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const name of ALL_SWEDISH_NAMES) {
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "giu");

    for (const match of text.matchAll(regex)) {
      const value = match[0];
      const key = value.toLocaleLowerCase("sv-SE");

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      matches.push(value);

      if (matches.length >= limit) {
        return matches;
      }
    }
  }

  return matches;
}
