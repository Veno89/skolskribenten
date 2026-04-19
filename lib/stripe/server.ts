import Stripe from "stripe";

export const STRIPE_API_VERSION = "2024-06-20";

export function createStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion:
      STRIPE_API_VERSION as unknown as NonNullable<
        ConstructorParameters<typeof Stripe>[1]
      >["apiVersion"],
  });
}
