import { createHash } from "node:crypto";

export const BREACHED_PASSWORD_MESSAGE =
  "Välj ett annat lösenord. Det här lösenordet förekommer i kända dataläckor.";

const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range";
const DEFAULT_TIMEOUT_MS = 2500;

type PwnedPasswordFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface BreachedPasswordCheckResult {
  checked: boolean;
  compromised: boolean;
  count: number;
  reason?: "disabled" | "unavailable";
}

export function getPasswordSha1Range(password: string): {
  prefix: string;
  suffix: string;
} {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();

  return {
    prefix: hash.slice(0, 5),
    suffix: hash.slice(5),
  };
}

export function findPwnedPasswordCount(rangeBody: string, suffix: string): number {
  const expectedSuffix = suffix.toUpperCase();

  for (const line of rangeBody.split(/\r?\n/)) {
    const [candidateSuffix, count] = line.trim().split(":");

    if (candidateSuffix?.toUpperCase() === expectedSuffix) {
      return Number.parseInt(count ?? "0", 10) || 0;
    }
  }

  return 0;
}

function isBreachedPasswordCheckDisabled(env: NodeJS.ProcessEnv): boolean {
  return env.HIBP_PASSWORD_CHECK_DISABLED === "true";
}

export async function checkBreachedPassword(
  password: string,
  options: {
    env?: NodeJS.ProcessEnv;
    fetcher?: PwnedPasswordFetcher;
    timeoutMs?: number;
  } = {},
): Promise<BreachedPasswordCheckResult> {
  const env = options.env ?? process.env;

  if (isBreachedPasswordCheckDisabled(env)) {
    return { checked: false, compromised: false, count: 0, reason: "disabled" };
  }

  const fetcher = options.fetcher ?? fetch;
  const { prefix, suffix } = getPasswordSha1Range(password);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetcher(`${PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Skolskribenten password breach check",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Pwned Passwords returned ${response.status}.`);
    }

    const count = findPwnedPasswordCount(await response.text(), suffix);
    return {
      checked: true,
      compromised: count > 0,
      count,
    };
  } catch (error) {
    console.warn("[Auth] Breached password check unavailable.", error);
    return { checked: false, compromised: false, count: 0, reason: "unavailable" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getBreachedPasswordValidationError(
  password: string,
): Promise<string | null> {
  const result = await checkBreachedPassword(password);

  return result.compromised ? BREACHED_PASSWORD_MESSAGE : null;
}
