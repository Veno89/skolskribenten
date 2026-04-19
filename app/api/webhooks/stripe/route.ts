import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest): Promise<Response> {
  const stripe = createStripeClient();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Ogiltig signatur." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Ogiltig signatur." }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const priceType = session.metadata?.price_type;

      if (!userId) {
        break;
      }

      if (priceType === "monthly") {
        await supabase
          .from("profiles")
          .update({
            subscription_status: "pro",
            subscription_end_date: null,
          })
          .eq("id", userId);
      } else if (priceType === "onetime") {
        await supabase
          .from("profiles")
          .update({
            subscription_status: "pro",
            subscription_end_date: addDays(new Date(), 30).toISOString(),
          })
          .eq("id", userId);
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customer = await stripe.customers.retrieve(
        subscription.customer as string,
      );

      if (!("deleted" in customer) && customer.metadata.supabase_user_id) {
        await supabase
          .from("profiles")
          .update({
            subscription_status: "cancelled",
            subscription_end_date: null,
          })
          .eq("id", customer.metadata.supabase_user_id);
      }

      break;
    }

    case "invoice.payment_failed": {
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
