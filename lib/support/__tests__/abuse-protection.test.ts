import { describe, expect, it } from "vitest";
import {
  getSupportRateLimitWindowStart,
  hasExceededSupportRateLimit,
  isDuplicateSupportRequest,
  isSupportHoneypotTriggered,
  normalizeSupportEmail,
  normalizeSupportMessage,
} from "@/lib/support/abuse-protection";

describe("support abuse protection", () => {
  it("normalizes email addresses and messages for comparisons", () => {
    expect(normalizeSupportEmail(" Larare@Skola.se ")).toBe("larare@skola.se");
    expect(normalizeSupportMessage("  Hej   supporten \n nu kör vi  ")).toBe("hej supporten nu kör vi");
  });

  it("detects when the rate-limit window is exhausted", () => {
    expect(
      hasExceededSupportRateLimit([
        { created_at: "2026-04-23T10:00:00.000Z", message: "Första" },
        { created_at: "2026-04-23T10:01:00.000Z", message: "Andra" },
        { created_at: "2026-04-23T10:02:00.000Z", message: "Tredje" },
      ]),
    ).toBe(true);
  });

  it("detects duplicate recent support messages", () => {
    expect(
      isDuplicateSupportRequest(
        [
          {
            created_at: "2026-04-23T10:05:00.000Z",
            message: "Jag behöver hjälp med cloudsync.",
          },
        ],
        "  jag behöver hjälp med cloudsync. ",
        new Date("2026-04-23T10:10:00.000Z"),
      ),
    ).toBe(true);
  });

  it("ignores honeypot values when the field stays blank", () => {
    expect(isSupportHoneypotTriggered("")).toBe(false);
    expect(isSupportHoneypotTriggered(" https://spam.example.com ")).toBe(true);
  });

  it("builds a stable rate-limit window start timestamp", () => {
    expect(getSupportRateLimitWindowStart(new Date("2026-04-23T10:15:00.000Z"))).toBe(
      "2026-04-23T10:00:00.000Z",
    );
  });
});
