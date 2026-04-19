export type AuthMessageType = "error" | "success" | "info";
export type AuthSearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_POST_AUTH_REDIRECT = "/skrivstation";

export function getStringParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeNextPath(
  next: string | undefined | null,
  fallback: string = DEFAULT_POST_AUTH_REDIRECT,
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function buildPath(
  pathname: string,
  params: Record<string, string | undefined> = {},
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function resolveRelativeUrl(base: string | URL, nextPath: string): URL {
  return new URL(nextPath, base);
}

export function getNoticeFromSearchParams(
  searchParams: AuthSearchParams | undefined,
): { type: AuthMessageType; message: string } | null {
  if (!searchParams) {
    return null;
  }

  for (const type of ["error", "success", "info"] as const) {
    const message = getStringParam(searchParams[type]);

    if (message) {
      return { type, message };
    }
  }

  return null;
}
