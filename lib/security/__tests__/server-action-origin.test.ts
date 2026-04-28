import { afterEach, describe, expect, it } from "vitest";
import {
  getAllowedServerActionOrigins,
  isValidServerActionOrigin,
} from "../server-action-origin";

function makeHeaders(values: Record<string, string | undefined>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

describe("server action origin validation", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("accepts same-origin posts based on forwarded host and protocol", () => {
    const headers = makeHeaders({
      origin: "https://skolskribenten.se",
      "x-forwarded-host": "skolskribenten.se",
      "x-forwarded-proto": "https",
    });

    expect(isValidServerActionOrigin(headers)).toBe(true);
  });

  it("rejects missing and cross-site origins", () => {
    expect(
      isValidServerActionOrigin(
        makeHeaders({
          host: "skolskribenten.se",
        }),
      ),
    ).toBe(false);

    expect(
      isValidServerActionOrigin(
        makeHeaders({
          host: "skolskribenten.se",
          origin: "https://evil.example",
        }),
      ),
    ).toBe(false);
  });

  it("allows the configured app URL as a trusted deployment origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.skolskribenten.se";
    const headers = makeHeaders({
      host: "internal-vercel-host.example",
      origin: "https://app.skolskribenten.se",
    });

    expect(getAllowedServerActionOrigins(headers).has("https://app.skolskribenten.se")).toBe(true);
    expect(isValidServerActionOrigin(headers)).toBe(true);
  });

  it("defaults localhost to http for local development forms", () => {
    expect(
      isValidServerActionOrigin(
        makeHeaders({
          host: "localhost:3000",
          origin: "http://localhost:3000",
        }),
      ),
    ).toBe(true);
  });
});
