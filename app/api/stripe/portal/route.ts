import { NextRequest } from "next/server";
import { getAuthoritativeEntitlementDecision } from "@/lib/billing/entitlements";
import {
  createRouteContext,
  jsonWithContext,
  logRouteInfo,
} from "@/lib/server/request-context";
import { getTrustedStripeReturnUrl } from "@/lib/stripe/config";
import { handleStripeRouteError } from "@/lib/stripe/route-error";
import { createStripeClient } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

function portalIdempotencyKey(userId: string): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);
  return `portal:${userId}:${minuteBucket}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "stripe.portal");

  try {
    const supabase = createClient();
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, subscription_status, subscription_end_date")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return handleStripeRouteError(
        context,
        "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
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
        "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
        entitlementError,
      );
    }

    const { data: customerMapping, error: mappingError } = await supabase
      .from("stripe_customer_mappings")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (mappingError) {
      return handleStripeRouteError(
        context,
        "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
        mappingError,
      );
    }

    const entitlementDecision = getAuthoritativeEntitlementDecision(entitlement);
    const customerId = customerMapping?.stripe_customer_id ?? profile?.stripe_customer_id ?? null;

    if (!customerId || !entitlementDecision.recurring) {
      return jsonWithContext(
        { error: "Det finns inget mÃ¥nadsabonnemang att hantera just nu." },
        { status: 400 },
        context,
      );
    }

    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: getTrustedStripeReturnUrl("/konto"),
      },
      {
        idempotencyKey: portalIdempotencyKey(user.id),
      },
    );

    if (!session.url) {
      return handleStripeRouteError(
        context,
        "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
        new Error("Stripe billing portal session missing URL."),
      );
    }

    logRouteInfo(context, "Created Stripe billing portal session.", {
      customerId,
      userId: user.id,
    });

    return jsonWithContext({ url: session.url }, { status: 200 }, context);
  } catch (error) {
    return handleStripeRouteError(
      context,
      "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
      error,
    );
  }
}
