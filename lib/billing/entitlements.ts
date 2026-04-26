import type { Profile } from "@/types";

export const FREE_TRANSFORM_LIMIT = 10;
export const PAID_TRANSFORM_LIMIT = 100;
export const MONTHLY_PRO_PRICE_SEK = 49;
export const ONE_TIME_PASS_PRICE_SEK = 49;
export const ONE_TIME_PASS_DURATION_DAYS = 30;

export const STRIPE_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "canceled",
  "paused",
  "incomplete",
  "incomplete_expired",
] as const;

export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];
export type EntitlementAccessLevel = "free" | "pro";
export type EntitlementSource = "none" | "recurring_subscription" | "one_time_pass" | "admin";

export interface AccountEntitlementSnapshot {
  access_level: EntitlementAccessLevel;
  paid_access_until: string | null;
  reason: string;
  source: EntitlementSource;
}

type EntitlementSnapshot = Pick<
  Profile,
  "subscription_status" | "subscription_end_date" | "transforms_used_this_month"
>;

export interface EntitlementDecision {
  accessLevel: EntitlementAccessLevel;
  active: boolean;
  source: EntitlementSource;
  reason: string;
  recurring: boolean;
  paidAccessUntil: string | null;
}

export interface StripeSubscriptionEntitlementDecision {
  active: boolean;
  reason: string;
}

export function getStripeSubscriptionEntitlementDecision(
  status: StripeSubscriptionStatus,
): StripeSubscriptionEntitlementDecision {
  switch (status) {
    case "trialing":
      return { active: true, reason: "stripe_subscription_trialing" };
    case "active":
      return { active: true, reason: "stripe_subscription_active" };
    case "past_due":
      return { active: false, reason: "stripe_subscription_past_due_strict_no_grace" };
    case "unpaid":
      return { active: false, reason: "stripe_subscription_unpaid" };
    case "canceled":
      return { active: false, reason: "stripe_subscription_canceled" };
    case "paused":
      return { active: false, reason: "stripe_subscription_paused" };
    case "incomplete":
      return { active: false, reason: "stripe_subscription_incomplete" };
    case "incomplete_expired":
      return { active: false, reason: "stripe_subscription_incomplete_expired" };
  }
}

export function getEntitlementDecision(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): EntitlementDecision {
  if (profile.subscription_status !== "pro") {
    return {
      accessLevel: "free",
      active: false,
      source: "none",
      reason: profile.subscription_status === "cancelled" ? "local_subscription_cancelled" : "free_plan",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (profile.subscription_end_date === null) {
    return {
      accessLevel: "pro",
      active: true,
      source: "recurring_subscription",
      reason: "local_recurring_pro_active",
      recurring: true,
      paidAccessUntil: null,
    };
  }

  const endDate = new Date(profile.subscription_end_date);

  if (Number.isNaN(endDate.getTime())) {
    return {
      accessLevel: "free",
      active: false,
      source: "none",
      reason: "invalid_paid_access_until",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (endDate <= now) {
    return {
      accessLevel: "free",
      active: false,
      source: "one_time_pass",
      reason: "one_time_pass_expired",
      recurring: false,
      paidAccessUntil: profile.subscription_end_date,
    };
  }

  return {
    accessLevel: "pro",
    active: true,
    source: "one_time_pass",
    reason: "one_time_pass_active",
    recurring: false,
    paidAccessUntil: profile.subscription_end_date,
  };
}

export function getAuthoritativeEntitlementDecision(
  entitlement: AccountEntitlementSnapshot | null,
  now: Date = new Date(),
): EntitlementDecision {
  if (!entitlement) {
    return {
      accessLevel: "free",
      active: false,
      source: "none",
      reason: "no_authoritative_entitlement",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (entitlement.access_level !== "pro") {
    return {
      accessLevel: "free",
      active: false,
      source: "none",
      reason: entitlement.reason || "authoritative_free_entitlement",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (entitlement.source === "recurring_subscription") {
    return {
      accessLevel: "pro",
      active: true,
      source: "recurring_subscription",
      reason: entitlement.reason || "authoritative_recurring_pro_active",
      recurring: true,
      paidAccessUntil: null,
    };
  }

  if (entitlement.source === "admin") {
    if (!entitlement.paid_access_until) {
      return {
        accessLevel: "pro",
        active: true,
        source: "admin",
        reason: entitlement.reason || "authoritative_admin_pro_active",
        recurring: false,
        paidAccessUntil: null,
      };
    }

    const adminAccessUntil = new Date(entitlement.paid_access_until);

    if (!Number.isNaN(adminAccessUntil.getTime()) && adminAccessUntil > now) {
      return {
        accessLevel: "pro",
        active: true,
        source: "admin",
        reason: entitlement.reason || "authoritative_admin_pro_active",
        recurring: false,
        paidAccessUntil: entitlement.paid_access_until,
      };
    }

    return {
      accessLevel: "free",
      active: false,
      source: "admin",
      reason: "authoritative_admin_access_expired",
      recurring: false,
      paidAccessUntil: entitlement.paid_access_until,
    };
  }

  if (entitlement.source !== "one_time_pass") {
    return {
      accessLevel: "free",
      active: false,
      source: "none",
      reason: "invalid_authoritative_entitlement_source",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (!entitlement.paid_access_until) {
    return {
      accessLevel: "free",
      active: false,
      source: "one_time_pass",
      reason: "one_time_pass_missing_paid_access_until",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  const endDate = new Date(entitlement.paid_access_until);

  if (Number.isNaN(endDate.getTime())) {
    return {
      accessLevel: "free",
      active: false,
      source: "one_time_pass",
      reason: "invalid_paid_access_until",
      recurring: false,
      paidAccessUntil: null,
    };
  }

  if (endDate <= now) {
    return {
      accessLevel: "free",
      active: false,
      source: "one_time_pass",
      reason: "one_time_pass_expired",
      recurring: false,
      paidAccessUntil: entitlement.paid_access_until,
    };
  }

  return {
    accessLevel: "pro",
    active: true,
    source: "one_time_pass",
    reason: entitlement.reason || "authoritative_one_time_pass_active",
    recurring: false,
    paidAccessUntil: entitlement.paid_access_until,
  };
}

export function isActivePro(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): boolean {
  return getEntitlementDecision(profile, now).active;
}

export function isRecurringPro(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): boolean {
  return getEntitlementDecision(profile, now).recurring;
}

export function getMonthlyTransformLimit(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): number {
  return isActivePro(profile, now) ? PAID_TRANSFORM_LIMIT : FREE_TRANSFORM_LIMIT;
}

export function hasExceededTransformLimit(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date" | "transforms_used_this_month">,
  now: Date = new Date(),
): boolean {
  return profile.transforms_used_this_month >= getMonthlyTransformLimit(profile, now);
}

export function getQuotaExceededMessage(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date" | "transforms_used_this_month">,
  now: Date = new Date(),
): string {
  if (isActivePro(profile, now)) {
    return `Du har använt månadens ${PAID_TRANSFORM_LIMIT} Pro-omvandlingar. Kvoten fylls på nästa månad.`;
  }

  return `Du har använt dina ${FREE_TRANSFORM_LIMIT} gratis omvandlingar den här månaden. Uppgradera för att fortsätta.`;
}

export function formatEntitlementEndDate(
  subscriptionEndDate: string | null,
  locale: string = "sv-SE",
): string | null {
  if (!subscriptionEndDate) {
    return null;
  }

  const date = new Date(subscriptionEndDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale).format(date);
}

export function getCurrentPlanLabel(profile: EntitlementSnapshot, now: Date = new Date()): string {
  if (!isActivePro(profile, now)) {
    return `Gratis - ${FREE_TRANSFORM_LIMIT} omvandlingar per månad`;
  }

  return profile.subscription_end_date === null
    ? `Pro - ${PAID_TRANSFORM_LIMIT} omvandlingar per månad, ${MONTHLY_PRO_PRICE_SEK} kr/mån`
    : `${ONE_TIME_PASS_DURATION_DAYS}-dagarskort - ${PAID_TRANSFORM_LIMIT} omvandlingar per månad i ${ONE_TIME_PASS_DURATION_DAYS} dagar, ${ONE_TIME_PASS_PRICE_SEK} kr`;
}

export function getUsageSummary(profile: EntitlementSnapshot, now: Date = new Date()): string {
  if (isActivePro(profile, now)) {
    return `${profile.transforms_used_this_month} av ${PAID_TRANSFORM_LIMIT} Pro-omvandlingar använda den här månaden`;
  }

  return `${profile.transforms_used_this_month} av ${FREE_TRANSFORM_LIMIT} gratis omvandlingar använda`;
}
