import { ALL_SWEDISH_NAMES, escapeRegex, SWEDISH_PATTERNS } from "./patterns";

export interface ScrubberResult {
  scrubbedText: string;
  replacements: Map<string, string>;
  unmatchedCapitalized: string[];
  stats: {
    namesReplaced: number;
    piiTokensReplaced: number;
  };
}

export interface ScrubberOptions {
  customNames?: string[];
}

interface CollectUnmatchedCapitalizedOptions {
  ignoreSentenceInitialWords?: boolean;
}

const SAFE_CAPITALIZED_WORDS = new Set([
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
  "Svenska",
  "Matematik",
  "Engelska",
  "Historia",
  "Biologi",
  "Kemi",
  "Fysik",
  "Musik",
  "Idrott",
  "Bild",
  "Slöjd",
  "Teknik",
  "Lgr",
  "Skolverket",
  "Unikum",
  "Sverige",
  "Stockholm",
  "Elev",
]);

export class GdprScrubber {
  private entityCounter = 0;
  private entityMap = new Map<string, string>();

  scrub(text: string, options: ScrubberOptions = {}): ScrubberResult {
    this.entityCounter = 0;
    this.entityMap.clear();

    let processed = text;
    let piiTokensReplaced = 0;
    const replacements = new Map<string, string>();
    const replacedEntityKeys = new Set<string>();

    // Structural identifiers are scrubbed before names so a personal name inside
    // an address or email never influences the name placeholder mapping.
    processed = processed.replace(SWEDISH_PATTERNS.samordningsnummer, () => {
      piiTokensReplaced += 1;
      return "[samordningsnummer]";
    });
    processed = processed.replace(SWEDISH_PATTERNS.personnummer, () => {
      piiTokensReplaced += 1;
      return "[personnummer]";
    });
    processed = processed.replace(SWEDISH_PATTERNS.phone, () => {
      piiTokensReplaced += 1;
      return "[telefonnummer]";
    });
    processed = processed.replace(SWEDISH_PATTERNS.email, () => {
      piiTokensReplaced += 1;
      return "[e-postadress]";
    });

    const allNames = buildNameList(options.customNames);

    for (const name of allNames) {
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "giu");
      processed = processed.replace(regex, (match) => {
        const key = normalizeEntityKey(match);
        const placeholder = this.getPlaceholder(match);

        if (!replacedEntityKeys.has(key)) {
          replacedEntityKeys.add(key);
          replacements.set(match, placeholder);
        }

        return placeholder;
      });
    }

    return {
      scrubbedText: processed,
      replacements,
      unmatchedCapitalized: collectUnmatchedCapitalizedWords(processed),
      stats: {
        namesReplaced: replacedEntityKeys.size,
        piiTokensReplaced,
      },
    };
  }

  private getPlaceholder(original: string, prefix = "Elev"): string {
    const key = normalizeEntityKey(original);

    if (!this.entityMap.has(key)) {
      this.entityCounter += 1;
      this.entityMap.set(key, `[${prefix} ${this.entityCounter}]`);
    }

    return this.entityMap.get(key)!;
  }
}

function buildNameList(customNames: string[] | undefined): string[] {
  const seen = new Set<string>();
  const names = [...ALL_SWEDISH_NAMES, ...(customNames ?? [])]
    .map((name) => name.trim())
    .filter((name) => name.length > 1)
    .filter((name) => {
      const key = normalizeEntityKey(name);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return names.sort((left, right) => right.length - left.length);
}

export function collectUnmatchedCapitalizedWords(
  text: string,
  options: CollectUnmatchedCapitalizedOptions = {},
): string[] {
  const ignoreSentenceInitialWords = options.ignoreSentenceInitialWords ?? true;
  const words = Array.from(
    text.matchAll(/\b[A-ZÅÄÖ][a-zåäö]{2,}\b/g),
    (match) => ({
      word: match[0],
      index: match.index ?? 0,
    }),
  );

  const unmatched = words.filter(({ word, index }) => {
    if (SAFE_CAPITALIZED_WORDS.has(word)) {
      return false;
    }

    if (text[index - 1] === "[") {
      return false;
    }

    if (!ignoreSentenceInitialWords) {
      return true;
    }

    return !isSentenceInitialWord(text, index);
  });

  return Array.from(new Set(unmatched.map(({ word }) => word)));
}

function isSentenceInitialWord(text: string, index: number): boolean {
  let cursor = index - 1;

  while (cursor >= 0 && /\s/.test(text[cursor])) {
    cursor -= 1;
  }

  if (cursor < 0) {
    return true;
  }

  return /[.!?\n]/.test(text[cursor]);
}

function normalizeEntityKey(value: string): string {
  return value.toLocaleLowerCase("sv-SE");
}
