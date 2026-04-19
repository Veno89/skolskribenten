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

      // Idempotency guard: check if this checkout session has already been
      // processed by looking at the current profile state. For monthly subs
      // this is harmless (idempotent update), but for one-time passes we
      // must avoid extending the end date on duplicate webhook deliveries.
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_end_date")
        .eq("id", userId)
        .single();

      if (priceType === "monthly") {
        // Monthly subscription: idempotent — setting to "pro" with null end date
        // is safe even on duplicate events.
        await supabase
          .from("profiles")
          .update({
            subscription_status: "pro",
            subscription_end_date: null,
          })
          .eq("id", userId);
      } else if (priceType === "onetime") {
        // Use the Stripe event creation timestamp (seconds since epoch) rather
        // than the server's current time. This ensures that duplicate webhook
        // deliveries produce the same end date instead of extending the pass.
        const eventCreatedAt = new Date(event.created * 1000);
        const endDate = addDays(eventCreatedAt, 30).toISOString();

        // If the user is already pro with a later end date, skip the update
        // to avoid shortening an existing pass or overwriting a monthly sub.
        if (
          existingProfile?.subscription_status === "pro" &&
          existingProfile.subscription_end_date !== null &&
          new Date(existingProfile.subscription_end_date) >= new Date(endDate)
        ) {
          console.info(
            `[Stripe Webhook] Skipping duplicate checkout.session.completed for user ${userId}. ` +
            `Existing end date ${existingProfile.subscription_end_date} >= new end date ${endDate}.`,
          );
          break;
        }

        await supabase
          .from("profiles")
          .update({
            subscription_status: "pro",
            subscription_end_date: endDate,
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
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;

      if (!customerId) {
        console.error("[Stripe Webhook] invoice.payment_failed: no customer ID found.");
        break;
      }

      const customer = await stripe.customers.retrieve(customerId);

      if ("deleted" in customer || !customer.metadata.supabase_user_id) {
        break;
      }

      const failedUserId = customer.metadata.supabase_user_id;

      // Log the failure prominently for operational visibility.
      console.error(
        `[Stripe Webhook] Payment failed for user ${failedUserId}. ` +
        `Invoice ${invoice.id}, attempt ${invoice.attempt_count ?? "unknown"}.`,
      );

      // After the third failed attempt, downgrade the user so they don't
      // keep unlimited access indefinitely while their payment is failing.
      if (invoice.attempt_count && invoice.attempt_count >= 3) {
        console.error(
          `[Stripe Webhook] Downgrading user ${failedUserId} after ${invoice.attempt_count} failed payment attempts.`,
        );

        await supabase
          .from("profiles")
          .update({
            subscription_status: "cancelled",
            subscription_end_date: null,
          })
          .eq("id", failedUserId);
      }

      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
