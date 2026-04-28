import { describe, expect, it } from "vitest";
import { getBillingPricingConfig } from "../pricing";

describe("billing pricing config", () => {
  it("uses default launch pricing when env overrides are absent", () => {
    expect(getBillingPricingConfig({} as unknown as NodeJS.ProcessEnv)).toEqual({
      monthlyProPriceSek: 49,
      oneTimePassDurationDays: 30,
      oneTimePassPriceSek: 49,
    });
  });

  it("reads runtime pricing overrides from env", () => {
    expect(
      getBillingPricingConfig({
        BILLING_MONTHLY_PRO_PRICE_SEK: "79",
        BILLING_ONE_TIME_PASS_DURATION_DAYS: "45",
        BILLING_ONE_TIME_PASS_PRICE_SEK: "59",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      monthlyProPriceSek: 79,
      oneTimePassDurationDays: 45,
      oneTimePassPriceSek: 59,
    });
  });

  it("rejects malformed pricing values", () => {
    expect(() =>
      getBillingPricingConfig({
        BILLING_MONTHLY_PRO_PRICE_SEK: "49.5",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow("BILLING_MONTHLY_PRO_PRICE_SEK must be a positive integer.");
  });
});
