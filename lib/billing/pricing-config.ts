export interface BillingPricingConfig {
  monthlyProPriceSek: number;
  oneTimePassDurationDays: number;
  oneTimePassPriceSek: number;
}

export const DEFAULT_BILLING_PRICING_CONFIG: BillingPricingConfig = {
  monthlyProPriceSek: 49,
  oneTimePassDurationDays: 30,
  oneTimePassPriceSek: 49,
};
