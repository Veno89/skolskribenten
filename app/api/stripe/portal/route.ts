import { NextResponse } from "next/server";
import { isRecurringPro } from "@/lib/billing/entitlements";
import { createStripeClient } from "@/lib/stripe/server";
import { getAppUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(): Promise<Response> {
  const supabase = createClient();
  const stripe = createStripeClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Du behöver logga in för att fortsätta." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, subscription_status, subscription_end_date")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id || !isRecurringPro(profile)) {
    return NextResponse.json(
      { error: "Det finns inget månadsabonnemang att hantera just nu." },
      { status: 400 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${getAppUrl()}/konto`,
  });

  return NextResponse.json({ url: session.url });
}
