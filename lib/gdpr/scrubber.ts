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
  safeCapitalizedWords?: string[];
}

interface CollectUnmatchedCapitalizedOptions {
  ignoreSentenceInitialWords?: boolean;
  safeCapitalizedWords?: string[];
}

const SAFE_CAPITALIZED_WORDS = new Set([
  "April",
  "Augusti",
  "Biblioteket",
  "Biologi",
  "December",
  "Den",
  "Det",
  "Efter",
  "Eftersom",
  "Elev",
  "Eleven",
  "Eleverna",
  "Engelska",
  "Februari",
  "Fredag",
  "Fritids",
  "Fysik",
  "Gruppen",
  "Han",
  "Helklass",
  "Historia",
  "Hon",
  "Idag",
  "Idrott",
  "Igår",
  "Imorgon",
  "Innan",
  "Jag",
  "Januari",
  "Juli",
  "Juni",
  "Kemi",
  "Klassen",
  "Klassrummet",
  "Kurator",
  "Lektion",
  "Lektionen",
  "Lgr",
  "Lärare",
  "Läraren",
  "Maj",
  "Mars",
  "Matematik",
  "Matsalen",
  "Mentor",
  "Musik",
  "November",
  "Nu",
  "När",
  "Oktober",
  "Onsdag",
  "Personal",
  "Rektor",
  "Sedan",
  "September",
  "Skolan",
  "Skolgården",
  "Skolverket",
  "Speciallärare",
  "Specialpedagog",
  "Stockholm",
  "Svenska",
  "Sverige",
  "Söndag",
  "Teknik",
  "Tisdag",
  "Torsdag",
  "Under",
  "Unikum",
  "Vardnadshavare",
  "Vårdnadshavare",
  "Vi",
  "Ågrupp",
  "Årskurs",
  "Ämne",
  "Övrigt",
  "Lördag",
  "Måndag",
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

    processed = this.replaceDetectedNames(
      processed,
      buildNameList(options.customNames),
      replacements,
      replacedEntityKeys,
    );

    processed = this.replaceDetectedNames(
      processed,
      collectLikelyUnknownNameWords(processed, {
        safeCapitalizedWords: options.safeCapitalizedWords,
      }),
      replacements,
      replacedEntityKeys,
    );

    return {
      scrubbedText: processed,
      replacements,
      unmatchedCapitalized: collectUnmatchedCapitalizedWords(processed, {
        safeCapitalizedWords: options.safeCapitalizedWords,
      }),
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

  private replaceDetectedNames(
    text: string,
    names: string[],
    replacements: Map<string, string>,
    replacedEntityKeys: Set<string>,
  ): string {
    let processed = text;

    for (const name of names) {
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

    return processed;
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
  const safeCapitalizedWords = buildSafeCapitalizedWordSet(options.safeCapitalizedWords);
  const words = getCapitalizedWordMatches(text);

  const unmatched = words.filter(({ word, index }) => {
    if (isIgnoredCapitalizedWord(text, word, index, safeCapitalizedWords)) {
      return false;
    }

    if (!ignoreSentenceInitialWords) {
      return true;
    }

    return !isSentenceInitialWord(text, index);
  });

  return Array.from(new Set(unmatched.map(({ word }) => word)));
}

export function collectLikelyUnknownNameWords(
  text: string,
  options: { safeCapitalizedWords?: string[] } = {},
): string[] {
  const groupedMatches = new Map<string, Array<{ index: number; word: string }>>();
  const safeCapitalizedWords = buildSafeCapitalizedWordSet(options.safeCapitalizedWords);

  for (const match of getCapitalizedWordMatches(text)) {
    if (isIgnoredCapitalizedWord(text, match.word, match.index, safeCapitalizedWords)) {
      continue;
    }

    const key = normalizeEntityKey(match.word);
    const matches = groupedMatches.get(key) ?? [];
    matches.push(match);
    groupedMatches.set(key, matches);
  }

  return Array.from(groupedMatches.values())
    .filter(
      (matches) =>
        matches.length > 1 ||
        matches.some(({ index }) => !isSentenceInitialWord(text, index)),
    )
    .map((matches) => matches[0].word);
}

function getCapitalizedWordMatches(text: string): Array<{ index: number; word: string }> {
  return Array.from(text.matchAll(/\b\p{Lu}\p{Ll}{2,}\b/gu), (match) => ({
    word: match[0],
    index: match.index ?? 0,
  }));
}

function buildSafeCapitalizedWordSet(extraWords: string[] | undefined): Set<string> {
  const safeWords = new Set(SAFE_CAPITALIZED_WORDS);

  for (const word of extraWords ?? []) {
    const trimmed = word.trim();

    if (trimmed) {
      safeWords.add(trimmed);
    }
  }

  return safeWords;
}

function isIgnoredCapitalizedWord(
  text: string,
  word: string,
  index: number,
  safeWords: Set<string>,
): boolean {
  if (safeWords.has(word)) {
    return true;
  }

  return text[index - 1] === "[";
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
