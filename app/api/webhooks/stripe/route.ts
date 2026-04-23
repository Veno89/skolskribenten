import { addDays } from "date-fns";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import {
  createRouteContext,
  jsonWithContext,
  logRouteError,
  logRouteInfo,
} from "@/lib/server/request-context";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ExistingProfile = {
  subscription_status: string | null;
  subscription_end_date: string | null;
};

async function loadExistingProfile(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ExistingProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_end_date")
    .eq("id", userId)
    .single();

  return data;
}

async function grantOneTimeAccess(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  grantedAt: Date,
  context: ReturnType<typeof createRouteContext>,
): Promise<void> {
  const existingProfile = await loadExistingProfile(supabase, userId);
  const endDate = addDays(grantedAt, 30).toISOString();

  if (
    existingProfile?.subscription_status === "pro" &&
    existingProfile.subscription_end_date === null
  ) {
    logRouteInfo(context, "Skipping one-time grant because recurring Pro is already active.", {
      userId,
    });
    return;
  }

  if (
    existingProfile?.subscription_status === "pro" &&
    existingProfile.subscription_end_date !== null &&
    new Date(existingProfile.subscription_end_date) >= new Date(endDate)
  ) {
    logRouteInfo(context, "Skipping duplicate one-time fulfillment.", {
      existingEndDate: existingProfile.subscription_end_date,
      newEndDate: endDate,
      userId,
    });
    return;
  }

  await supabase
    .from("profiles")
    .update({
      subscription_status: "pro",
      subscription_end_date: endDate,
    })
    .eq("id", userId);
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "stripe.webhook");
  const stripe = createStripeClient();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return jsonWithContext({ error: "Ogiltig signatur." }, { status: 400 }, context);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    logRouteError(context, "Webhook signature verification failed.", error);
    return jsonWithContext({ error: "Ogiltig signatur." }, { status: 400 }, context);
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
        logRouteInfo(context, "Ignoring one-time checkout completion until payment succeeds.", {
          userId,
        });
      }

      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const userId = paymentIntent.metadata?.supabase_user_id;
      const priceType = paymentIntent.metadata?.price_type;

      if (!userId || priceType !== "onetime") {
        break;
      }

      await grantOneTimeAccess(supabase, userId, new Date(event.created * 1000), context);
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
        logRouteError(context, "Payment failed event had no customer ID.");
        break;
      }

      const customer = await stripe.customers.retrieve(customerId);

      if ("deleted" in customer || !customer.metadata.supabase_user_id) {
        break;
      }

      const failedUserId = customer.metadata.supabase_user_id;

      logRouteError(context, "Payment failed for recurring subscription.", undefined, {
        attemptCount: invoice.attempt_count ?? null,
        invoiceId: invoice.id,
        userId: failedUserId,
      });

      if (invoice.attempt_count && invoice.attempt_count >= 3) {
        logRouteError(context, "Downgrading user after repeated payment failures.", undefined, {
          attemptCount: invoice.attempt_count,
          userId: failedUserId,
        });

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

  return jsonWithContext({ received: true }, { status: 200 }, context);
}
