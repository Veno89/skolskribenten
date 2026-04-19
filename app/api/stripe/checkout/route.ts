import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isActivePro } from "@/lib/billing/entitlements";
import { createStripeClient } from "@/lib/stripe/server";
import { getAppUrl } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const CheckoutSchema = z.object({
  priceType: z.enum(["monthly", "onetime"]),
});

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = createClient();
  const stripe = createStripeClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Du behöver logga in för att fortsätta." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, stripe_customer_id, subscription_status, subscription_end_date")
    .eq("id", user.id)
    .single();

  if (profile && isActivePro(profile)) {
    return NextResponse.json(
      { error: "Du har redan en aktiv Pro-plan på kontot." },
      { status: 409 },
    );
  }

  let customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email,
      metadata: { supabase_user_id: user.id },
    });

    customerId = customer.id;

    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const isRecurring = parsed.data.priceType === "monthly";
  const priceId = isRecurring
    ? process.env.STRIPE_PRICE_MONTHLY_PRO!
    : process.env.STRIPE_PRICE_ONETIME_30DAY!;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isRecurring ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_types: ["card", "swish"],
    locale: "sv",
    success_url: `${getAppUrl()}/konto?payment=success`,
    cancel_url: `${getAppUrl()}/konto?payment=cancelled`,
    metadata: {
      supabase_user_id: user.id,
      price_type: parsed.data.priceType,
    },
  });

  return NextResponse.json({ url: session.url });
}
