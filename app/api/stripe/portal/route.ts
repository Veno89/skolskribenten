import { NextRequest } from "next/server";
import { isRecurringPro } from "@/lib/billing/entitlements";
import { createRouteContext, jsonWithContext } from "@/lib/server/request-context";
import { handleStripeRouteError } from "@/lib/stripe/route-error";
import { createStripeClient } from "@/lib/stripe/server";
import { getAppUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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
        { error: "Du behöver logga in för att fortsätta." },
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
        "Kunde inte öppna kundportalen just nu. Försök igen om en stund.",
        profileError,
      );
    }

    if (!profile?.stripe_customer_id || !isRecurringPro(profile)) {
      return jsonWithContext(
        { error: "Det finns inget månadsabonnemang att hantera just nu." },
        { status: 400 },
        context,
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getAppUrl()}/konto`,
    });

    if (!session.url) {
      return handleStripeRouteError(
        context,
        "Kunde inte öppna kundportalen just nu. Försök igen om en stund.",
        new Error("Stripe billing portal session missing URL."),
      );
    }

    return jsonWithContext({ url: session.url }, { status: 200 }, context);
  } catch (error) {
    return handleStripeRouteError(
      context,
      "Kunde inte öppna kundportalen just nu. Försök igen om en stund.",
      error,
    );
  }
}
