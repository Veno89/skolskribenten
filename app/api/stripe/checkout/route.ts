import { NextRequest } from "next/server";
import { z } from "zod";
import { isActivePro } from "@/lib/billing/entitlements";
import { createRouteContext, jsonWithContext } from "@/lib/server/request-context";
import { handleStripeRouteError } from "@/lib/stripe/route-error";
import { createStripeClient } from "@/lib/stripe/server";
import { getAppUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const CheckoutSchema = z.object({
  priceType: z.enum(["monthly", "onetime"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "stripe.checkout");

  try {
    const supabase = createClient();
    const stripe = createStripeClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonWithContext(
        { error: "Du behöver logga in för att fortsätta." },
        { status: 401 },
        context,
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonWithContext({ error: "Ogiltig förfrågan" }, { status: 400 }, context);
    }

    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithContext({ error: "Ogiltig förfrågan" }, { status: 400 }, context);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, stripe_customer_id, subscription_status, subscription_end_date")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return handleStripeRouteError(
        context,
        "Kunde inte starta betalningen just nu. Försök igen om en stund.",
        profileError,
      );
    }

    if (profile && isActivePro(profile)) {
      return jsonWithContext(
        { error: "Du har redan en aktiv Pro-plan på kontot." },
        { status: 409 },
        context,
      );
    }

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        metadata: { supabase_user_id: user.id },
      });

      customerId = customer.id;

      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      if (updateProfileError) {
        return handleStripeRouteError(
          context,
          "Kunde inte starta betalningen just nu. Försök igen om en stund.",
          updateProfileError,
        );
      }
    }

    const isRecurring = parsed.data.priceType === "monthly";
    const priceId = isRecurring
      ? process.env.STRIPE_PRICE_MONTHLY_PRO!
      : process.env.STRIPE_PRICE_ONETIME_30DAY!;
    const metadata = {
      supabase_user_id: user.id,
      price_type: parsed.data.priceType,
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isRecurring ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: isRecurring ? ["card"] : ["card", "swish"],
      locale: "sv",
      success_url: `${getAppUrl()}/konto?payment=success`,
      cancel_url: `${getAppUrl()}/konto?payment=cancelled`,
      metadata,
      ...(isRecurring
        ? {}
        : {
          payment_intent_data: {
            metadata,
          },
        }),
    });

    if (!session.url) {
      return handleStripeRouteError(
        context,
        "Kunde inte starta betalningen just nu. Försök igen om en stund.",
        new Error("Stripe checkout session missing URL."),
      );
    }

    return jsonWithContext({ url: session.url }, { status: 200 }, context);
  } catch (error) {
    return handleStripeRouteError(
      context,
      "Kunde inte starta betalningen just nu. Försök igen om en stund.",
      error,
    );
  }
}
