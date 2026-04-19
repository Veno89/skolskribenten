import type { Profile } from "@/types";

export const FREE_TRANSFORM_LIMIT = 10;
export const MONTHLY_PRO_PRICE_SEK = 49;
export const ONE_TIME_PASS_PRICE_SEK = 49;
export const ONE_TIME_PASS_DURATION_DAYS = 30;

type EntitlementSnapshot = Pick<
  Profile,
  "subscription_status" | "subscription_end_date" | "transforms_used_this_month"
>;

export function isActivePro(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): boolean {
  return (
    profile.subscription_status === "pro" &&
    (profile.subscription_end_date === null || new Date(profile.subscription_end_date) > now)
  );
}

export function isRecurringPro(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date">,
  now: Date = new Date(),
): boolean {
  return isActivePro(profile, now) && profile.subscription_end_date === null;
}

export function hasExceededFreeTransformLimit(
  profile: Pick<EntitlementSnapshot, "subscription_status" | "subscription_end_date" | "transforms_used_this_month">,
  now: Date = new Date(),
): boolean {
  return !isActivePro(profile, now) && profile.transforms_used_this_month >= FREE_TRANSFORM_LIMIT;
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
    ? `Pro - Obegränsade omvandlingar, ${MONTHLY_PRO_PRICE_SEK} kr/mån`
    : `${ONE_TIME_PASS_DURATION_DAYS}-dagarskort - Obegränsade omvandlingar i ${ONE_TIME_PASS_DURATION_DAYS} dagar, ${ONE_TIME_PASS_PRICE_SEK} kr`;
}

export function getUsageSummary(profile: EntitlementSnapshot, now: Date = new Date()): string {
  if (isActivePro(profile, now)) {
    const entitlementEndDate = formatEntitlementEndDate(profile.subscription_end_date);

    return entitlementEndDate
      ? `${ONE_TIME_PASS_DURATION_DAYS}-dagarskort aktivt till ${entitlementEndDate}`
      : "Pro - obegränsade omvandlingar";
  }

  return `${profile.transforms_used_this_month} av ${FREE_TRANSFORM_LIMIT} gratis omvandlingar använda`;
}
