import { headers } from "next/headers";

export const SERVER_ACTION_ORIGIN_ERROR_MESSAGE =
  "Säkerhetskontrollen misslyckades. Ladda om sidan och försök igen.";

interface HeaderReader {
  get(name: string): string | null;
}

function getFirstHeaderValue(value: string | null): string | null {
  const firstValue = value?.split(",")[0]?.trim();
  return firstValue ? firstValue : null;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getDefaultProtocol(host: string | null): "http" | "https" {
  return host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
}

export function getAllowedServerActionOrigins(headerList: HeaderReader): Set<string> {
  const allowedOrigins = new Set<string>();
  const host =
    getFirstHeaderValue(headerList.get("x-forwarded-host")) ??
    getFirstHeaderValue(headerList.get("host"));
  const protocol =
    getFirstHeaderValue(headerList.get("x-forwarded-proto")) ?? getDefaultProtocol(host);

  if (host) {
    allowedOrigins.add(`${protocol}://${host}`);
  }

  const appOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

  if (appOrigin) {
    allowedOrigins.add(appOrigin);
  }

  return allowedOrigins;
}

export function isValidServerActionOrigin(headerList: HeaderReader): boolean {
  const requestOrigin = normalizeOrigin(headerList.get("origin"));

  if (!requestOrigin) {
    return false;
  }

  return getAllowedServerActionOrigins(headerList).has(requestOrigin);
}

export function isCurrentServerActionOriginValid(): boolean {
  return isValidServerActionOrigin(headers());
}
