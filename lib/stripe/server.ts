import Stripe from "stripe";
import { getStripeApiVersion, getStripeSecretKey } from "@/lib/stripe/config";

export function createStripeClient(): Stripe {
  const apiVersion = getStripeApiVersion();
  const options: ConstructorParameters<typeof Stripe>[1] = apiVersion
    ? {
        apiVersion: apiVersion as NonNullable<
          ConstructorParameters<typeof Stripe>[1]
        >["apiVersion"],
      }
    : undefined;

  return new Stripe(getStripeSecretKey(), options);
}
