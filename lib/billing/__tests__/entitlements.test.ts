import { describe, expect, it } from "vitest";
import {
  FREE_TRANSFORM_LIMIT,
  formatEntitlementEndDate,
  getCurrentPlanLabel,
  getUsageSummary,
  hasExceededFreeTransformLimit,
  isActivePro,
  isRecurringPro,
} from "../entitlements";

const NOW = new Date("2026-04-19T12:00:00.000Z");

describe("billing entitlements", () => {
  it("treats recurring pro as active", () => {
    expect(
      isActivePro(
        {
          subscription_status: "pro",
          subscription_end_date: null,
        },
        NOW,
      ),
    ).toBe(true);
    expect(
      isRecurringPro(
        {
          subscription_status: "pro",
          subscription_end_date: null,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("treats expired one-time access as inactive", () => {
    expect(
      isActivePro(
        {
          subscription_status: "pro",
          subscription_end_date: "2026-04-18T12:00:00.000Z",
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("detects when the free limit has been reached", () => {
    expect(
      hasExceededFreeTransformLimit(
        {
          subscription_status: "free",
          subscription_end_date: null,
          transforms_used_this_month: FREE_TRANSFORM_LIMIT,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("formats plan labels from one place", () => {
    expect(
      getCurrentPlanLabel(
        {
          subscription_status: "free",
          subscription_end_date: null,
          transforms_used_this_month: 2,
        },
        NOW,
      ),
    ).toBe("Gratis - 10 omvandlingar per månad");

    expect(
      getCurrentPlanLabel(
        {
          subscription_status: "pro",
          subscription_end_date: null,
          transforms_used_this_month: 2,
        },
        NOW,
      ),
    ).toBe("Pro - Obegränsade omvandlingar, 49 kr/mån");
  });

  it("builds usage summaries for free and paid access", () => {
    expect(
      getUsageSummary(
        {
          subscription_status: "free",
          subscription_end_date: null,
          transforms_used_this_month: 3,
        },
        NOW,
      ),
    ).toBe("3 av 10 gratis omvandlingar använda");

    expect(
      getUsageSummary(
        {
          subscription_status: "pro",
          subscription_end_date: "2026-05-01T00:00:00.000Z",
          transforms_used_this_month: 0,
        },
        NOW,
      ),
    ).toBe("30-dagarskort aktivt till 2026-05-01");
  });

  it("returns null for invalid entitlement dates", () => {
    expect(formatEntitlementEndDate("invalid-date")).toBeNull();
  });
});
