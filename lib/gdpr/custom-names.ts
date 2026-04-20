const NAME_SEPARATOR_PATTERN = /[\n\r,;]+/;

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("sv-SE");
}

export function parseCustomNamesInput(value: string): string[] {
  return value
    .split(NAME_SEPARATOR_PATTERN)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function mergeCustomNames(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map(normalizeName));
  const nextNames = [...existing];

  for (const name of incoming) {
    const trimmed = name.trim();

    if (!trimmed) {
      continue;
    }

    const normalized = normalizeName(trimmed);

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    nextNames.push(trimmed);
  }

  return nextNames;
}
