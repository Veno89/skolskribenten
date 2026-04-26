import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthoritativeEntitlementDecision } from "@/lib/billing/entitlements";
import {
  findStripeCustomerMappingByUserId,
  recordCheckoutSessionCreated,
  recordStripeCustomerMapping,
} from "@/lib/billing/stripe-projection";
import {
  createRouteContext,
  jsonWithContext,
  logRouteInfo,
} from "@/lib/server/request-context";
import { getStripePrice, getTrustedStripeReturnUrl } from "@/lib/stripe/config";
import { handleStripeRouteError } from "@/lib/stripe/route-error";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CheckoutSchema = z.object({
  priceType: z.enum(["monthly", "onetime"]),
});

function getStripeLivemode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
}

function checkoutIdempotencyKey(userId: string, priceKey: string): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return `checkout:${userId}:${priceKey}:${minuteBucket}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "stripe.checkout");

  try {
    const supabase = createClient();
    const adminSupabase = createAdminClient();
    const stripe = createStripeClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonWithContext(
        { error: "Du behÃ¶ver logga in fÃ¶r att fortsÃ¤tta." },
        { status: 401 },
        context,
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonWithContext({ error: "Ogiltig fÃ¶rfrÃ¥gan" }, { status: 400 }, context);
    }

    const parsed = CheckoutSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithContext({ error: "Ogiltig fÃ¶rfrÃ¥gan" }, { status: 400 }, context);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, stripe_customer_id, subscription_status, subscription_end_date")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return handleStripeRouteError(
        context,
        "Kunde inte starta betalningen just nu. FÃ¶rsÃ¶k igen om en stund.",
        profileError,
      );
    }

    const { data: entitlement, error: entitlementError } = await supabase
      .from("account_entitlements")
      .select("access_level, source, reason, paid_access_until")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      return handleStripeRouteError(
        context,
        "Kunde inte starta betalningen just nu. FÃ¶rsÃ¶k igen om en stund.",
        entitlementError,
      );
    }

    const entitlementDecision = getAuthoritativeEntitlementDecision(entitlement);

    if (entitlementDecision.active) {
      return jsonWithContext(
        { error: "Du har redan en aktiv Pro-plan pÃ¥ kontot." },
        { status: 409 },
        context,
      );
    }

    const price = getStripePrice(parsed.data.priceType);
    const livemode = getStripeLivemode();
    const existingMapping = await findStripeCustomerMappingByUserId(adminSupabase, user.id);
    let customerId = existingMapping?.stripe_customer_id ?? profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: profile?.email ?? user.email,
          metadata: { supabase_user_id: user.id },
        },
        {
          idempotencyKey: `customer:user:${user.id}`,
        },
      );

      customerId = customer.id;
    }

    await recordStripeCustomerMapping(adminSupabase, {
      customerId,
      livemode,
      userId: user.id,
    });

    const metadata = {
      price_key: price.key,
      supabase_user_id: user.id,
    };

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        client_reference_id: user.id,
        mode: price.mode,
        line_items: [{ price: price.priceId, quantity: 1 }],
        payment_method_types: price.paymentMethodTypes,
        locale: "sv",
        success_url: `${getTrustedStripeReturnUrl("/konto")}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getTrustedStripeReturnUrl("/konto")}?payment=cancelled`,
        metadata,
        ...(price.mode === "subscription"
          ? {
              subscription_data: {
                metadata,
              },
            }
          : {
              payment_intent_data: {
                metadata,
              },
            }),
      },
      {
        idempotencyKey: checkoutIdempotencyKey(user.id, price.key),
      },
    );

    if (!session.url) {
      return handleStripeRouteError(
        context,
        "Kunde inte starta betalningen just nu. FÃ¶rsÃ¶k igen om en stund.",
        new Error("Stripe checkout session missing URL."),
      );
    }

    await recordCheckoutSessionCreated(adminSupabase, {
      customerId,
      livemode: session.livemode,
      mode: price.mode,
      paymentStatus: session.payment_status,
      priceId: price.priceId,
      priceKey: price.key,
      sessionId: session.id,
      status: session.status,
      userId: user.id,
    });

    logRouteInfo(context, "Created Stripe Checkout session.", {
      mode: price.mode,
      priceKey: price.key,
      sessionId: session.id,
      userId: user.id,
    });

    return jsonWithContext({ url: session.url }, { status: 200 }, context);
  } catch (error) {
    return handleStripeRouteError(
      context,
      "Kunde inte starta betalningen just nu. FÃ¶rsÃ¶k igen om en stund.",
      error,
    );
  }
}
