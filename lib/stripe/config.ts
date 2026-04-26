import { z } from "zod";
import { getAppUrl } from "@/lib/supabase/config";

export const STRIPE_PRICE_KEYS = ["monthly", "onetime"] as const;

export type StripePriceKey = (typeof STRIPE_PRICE_KEYS)[number];
export type StripeCheckoutMode = "payment" | "subscription";

export interface StripePriceConfig {
  key: StripePriceKey;
  mode: StripeCheckoutMode;
  paymentMethodTypes: ["card"] | ["card", "swish"];
  priceId: string;
}

const SecretKeySchema = z
  .string()
  .min(1)
  .regex(/^sk_(test|live)_/, "STRIPE_SECRET_KEY must be a Stripe secret key.");

const WebhookSecretSchema = z
  .string()
  .min(1)
  .regex(/^whsec_/, "STRIPE_WEBHOOK_SECRET must start with whsec_.");

const PriceIdSchema = z
  .string()
  .min(1)
  .regex(/^price_/, "Stripe price IDs must start with price_.");

const ApiVersionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(\.[a-z]+)?$/, "STRIPE_API_VERSION is not a valid Stripe API version.")
  .optional();

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseEnv<T>(schema: z.ZodType<T>, name: string): T {
  const parsed = schema.safeParse(requiredEnv(name));

  if (!parsed.success) {
    throw new Error(`Invalid ${name}: ${parsed.error.issues[0]?.message ?? "invalid value"}`);
  }

  return parsed.data;
}

function assertLiveModeSafety(secretKey: string, appUrl: string): void {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  const isProduction = appEnv === "production";
  const usingTestKey = secretKey.startsWith("sk_test_");
  const usingLiveKey = secretKey.startsWith("sk_live_");
  const allowTestKeysInProduction = process.env.STRIPE_ALLOW_TEST_KEYS_IN_PRODUCTION === "true";

  if (isProduction && usingTestKey && !allowTestKeysInProduction) {
    throw new Error("Refusing to use Stripe test keys in production.");
  }

  if (usingLiveKey && /localhost|127\.0\.0\.1|\.local/i.test(appUrl)) {
    throw new Error("Refusing to use Stripe live keys with a local app URL.");
  }
}

export function getStripeSecretKey(): string {
  const secretKey = parseEnv(SecretKeySchema, "STRIPE_SECRET_KEY");
  assertLiveModeSafety(secretKey, getAppUrl());
  return secretKey;
}

export function getStripeWebhookSecret(): string {
  return parseEnv(WebhookSecretSchema, "STRIPE_WEBHOOK_SECRET");
}

export function getStripeApiVersion(): string | undefined {
  const parsed = ApiVersionSchema.safeParse(process.env.STRIPE_API_VERSION || undefined);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid STRIPE_API_VERSION.");
  }

  return parsed.data;
}

export function getStripePrices(): Record<StripePriceKey, StripePriceConfig> {
  return {
    monthly: {
      key: "monthly",
      mode: "subscription",
      paymentMethodTypes: ["card"],
      priceId: parseEnv(PriceIdSchema, "STRIPE_PRICE_MONTHLY_PRO"),
    },
    onetime: {
      key: "onetime",
      mode: "payment",
      paymentMethodTypes: ["card", "swish"],
      priceId: parseEnv(PriceIdSchema, "STRIPE_PRICE_ONETIME_30DAY"),
    },
  };
}

export function getStripePrice(key: StripePriceKey): StripePriceConfig {
  return getStripePrices()[key];
}

export function getStripePriceById(priceId: string): StripePriceConfig | null {
  return Object.values(getStripePrices()).find((price) => price.priceId === priceId) ?? null;
}

export function getTrustedStripeReturnUrl(pathname: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    throw new Error("Stripe return paths must be same-origin relative paths.");
  }

  return `${getAppUrl()}${pathname}`;
}
