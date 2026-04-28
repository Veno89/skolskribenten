import {
  DEFAULT_BILLING_PRICING_CONFIG,
  type BillingPricingConfig,
} from "@/lib/billing/pricing-config";

function parsePositiveIntegerEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const rawValue = env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function getBillingPricingConfig(
  env: NodeJS.ProcessEnv = process.env,
): BillingPricingConfig {
  return {
    monthlyProPriceSek: parsePositiveIntegerEnv(
      env,
      "BILLING_MONTHLY_PRO_PRICE_SEK",
      DEFAULT_BILLING_PRICING_CONFIG.monthlyProPriceSek,
    ),
    oneTimePassDurationDays: parsePositiveIntegerEnv(
      env,
      "BILLING_ONE_TIME_PASS_DURATION_DAYS",
      DEFAULT_BILLING_PRICING_CONFIG.oneTimePassDurationDays,
    ),
    oneTimePassPriceSek: parsePositiveIntegerEnv(
      env,
      "BILLING_ONE_TIME_PASS_PRICE_SEK",
      DEFAULT_BILLING_PRICING_CONFIG.oneTimePassPriceSek,
    ),
  };
}
