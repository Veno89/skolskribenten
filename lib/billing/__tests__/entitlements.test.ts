import { describe, expect, it } from "vitest";
import {
  FREE_TRANSFORM_LIMIT,
  PAID_TRANSFORM_LIMIT,
  PAST_DUE_GRACE_PERIOD_DAYS,
  formatEntitlementEndDate,
  getAuthoritativeEntitlementDecision,
  getCurrentPlanLabel,
  getEntitlementDecision,
  getMonthlyTransformLimit,
  getQuotaExceededMessage,
  getStripeSubscriptionEntitlementDecision,
  getUsageSummary,
  hasExceededTransformLimit,
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

  it("centralizes entitlement decisions with explicit reasons", () => {
    expect(
      getEntitlementDecision(
        {
          subscription_status: "cancelled",
          subscription_end_date: null,
        },
        NOW,
      ),
    ).toEqual({
      accessLevel: "free",
      active: false,
      paidAccessUntil: null,
      reason: "local_subscription_cancelled",
      recurring: false,
      source: "none",
    });
  });

  it("fails closed when no authoritative entitlement row exists", () => {
    expect(getAuthoritativeEntitlementDecision(null, NOW)).toEqual({
      accessLevel: "free",
      active: false,
      paidAccessUntil: null,
      reason: "no_authoritative_entitlement",
      recurring: false,
      source: "none",
    });
  });

  it("uses account_entitlements as the paid access source of truth", () => {
    expect(
      getAuthoritativeEntitlementDecision(
        {
          access_level: "pro",
          paid_access_until: null,
          reason: "stripe_subscription_active",
          source: "recurring_subscription",
        },
        NOW,
      ),
    ).toMatchObject({
      active: true,
      paidAccessUntil: null,
      recurring: true,
      reason: "stripe_subscription_active",
      source: "recurring_subscription",
    });

    expect(
      getAuthoritativeEntitlementDecision(
        {
          access_level: "pro",
          paid_access_until: "2026-04-24T12:00:00.000Z",
          reason: "stripe_subscription_past_due_grace_period",
          source: "recurring_subscription",
        },
        NOW,
      ),
    ).toMatchObject({
      active: true,
      paidAccessUntil: "2026-04-24T12:00:00.000Z",
      reason: "stripe_subscription_past_due_grace_period",
      source: "recurring_subscription",
    });

    expect(
      getAuthoritativeEntitlementDecision(
        {
          access_level: "pro",
          paid_access_until: "2026-04-18T12:00:00.000Z",
          reason: "stripe_subscription_past_due_grace_period",
          source: "recurring_subscription",
        },
        NOW,
      ),
    ).toMatchObject({
      active: false,
      paidAccessUntil: "2026-04-18T12:00:00.000Z",
      reason: "authoritative_recurring_grace_expired",
      source: "recurring_subscription",
    });

    expect(
      getAuthoritativeEntitlementDecision(
        {
          access_level: "pro",
          paid_access_until: "2026-04-18T12:00:00.000Z",
          reason: "one_time_checkout_paid",
          source: "one_time_pass",
        },
        NOW,
      ),
    ).toMatchObject({
      active: false,
      reason: "one_time_pass_expired",
      source: "one_time_pass",
    });
  });

  it.each([
    ["trialing", true, "stripe_subscription_trialing"],
    ["active", true, "stripe_subscription_active"],
    ["unpaid", false, "stripe_subscription_unpaid"],
    ["canceled", false, "stripe_subscription_canceled"],
    ["paused", false, "stripe_subscription_paused"],
    ["incomplete", false, "stripe_subscription_incomplete"],
    ["incomplete_expired", false, "stripe_subscription_incomplete_expired"],
  ] as const)("maps Stripe %s subscriptions to exact entitlement behavior", (status, active, reason) => {
    expect(getStripeSubscriptionEntitlementDecision(status)).toEqual({
      active,
      paidAccessUntil: null,
      reason,
    });
  });

  it("keeps past_due subscriptions active during a 7-day grace period", () => {
    expect(PAST_DUE_GRACE_PERIOD_DAYS).toBe(7);
    expect(
      getStripeSubscriptionEntitlementDecision("past_due", {
        now: new Date("2026-04-25T12:00:00.000Z"),
        pastDueSince: "2026-04-19T12:00:00.000Z",
      }),
    ).toEqual({
      active: true,
      paidAccessUntil: "2026-04-26T12:00:00.000Z",
      reason: "stripe_subscription_past_due_grace_period",
    });
  });

  it("expires past_due grace after 7 days or when no anchor exists", () => {
    expect(
      getStripeSubscriptionEntitlementDecision("past_due", {
        now: new Date("2026-04-27T12:00:00.000Z"),
        pastDueSince: "2026-04-19T12:00:00.000Z",
      }),
    ).toEqual({
      active: false,
      paidAccessUntil: null,
      reason: "stripe_subscription_past_due_grace_expired",
    });

    expect(getStripeSubscriptionEntitlementDecision("past_due")).toEqual({
      active: false,
      paidAccessUntil: null,
      reason: "stripe_subscription_past_due_missing_grace_anchor",
    });
  });

  it("detects when the free limit has been reached", () => {
    expect(
      hasExceededTransformLimit(
        {
          subscription_status: "free",
          subscription_end_date: null,
          transforms_used_this_month: FREE_TRANSFORM_LIMIT,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("detects when the paid monthly limit has been reached", () => {
    const profile = {
      subscription_status: "pro" as const,
      subscription_end_date: null,
      transforms_used_this_month: PAID_TRANSFORM_LIMIT,
    };

    expect(getMonthlyTransformLimit(profile, NOW)).toBe(PAID_TRANSFORM_LIMIT);
    expect(hasExceededTransformLimit(profile, NOW)).toBe(true);
    expect(getQuotaExceededMessage(profile, NOW)).toBe(
      "Du har använt månadens 100 Pro-omvandlingar. Kvoten fylls på nästa månad.",
    );
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
    ).toBe("Pro - 100 omvandlingar per månad, 49 kr/mån");

    expect(
      getCurrentPlanLabel(
        {
          subscription_status: "pro",
          subscription_end_date: "2026-05-01T00:00:00.000Z",
          transforms_used_this_month: 2,
        },
        NOW,
        {
          monthlyProPriceSek: 79,
          oneTimePassDurationDays: 45,
          oneTimePassPriceSek: 59,
        },
      ),
    ).toBe("45-dagarskort - 100 omvandlingar per månad i 45 dagar, 59 kr");
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
          transforms_used_this_month: 12,
        },
        NOW,
      ),
    ).toBe("12 av 100 Pro-omvandlingar använda den här månaden");
  });

  it("returns null for invalid entitlement dates", () => {
    expect(formatEntitlementEndDate("invalid-date")).toBeNull();
  });
});
