import { addDays } from "date-fns";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import {
  getStripeSubscriptionEntitlementDecision,
  STRIPE_SUBSCRIPTION_STATUSES,
  type StripeSubscriptionStatus,
} from "@/lib/billing/entitlements";
import {
  applyCheckoutSessionProjection,
  applySubscriptionProjection,
  claimStripeEvent,
  completeStripeEvent,
  findUserByStripeCustomerId,
} from "@/lib/billing/stripe-projection";
import {
  createRouteContext,
  jsonWithContext,
  logRouteError,
  logRouteInfo,
} from "@/lib/server/request-context";
import { getStripePriceById, getStripeWebhookSecret } from "@/lib/stripe/config";
import { createStripeClient } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ONE_TIME_PASS_DAYS = 30;

type AdminClient = ReturnType<typeof createAdminClient>;
type RouteContext = ReturnType<typeof createRouteContext>;

function stripeTimestampToIso(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

function getConfiguredLivemode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
}

function assertEventModeMatchesConfiguredKey(event: Stripe.Event): void {
  if (event.livemode !== getConfiguredLivemode()) {
    throw new Error("Stripe event livemode does not match the configured Stripe secret key.");
  }
}

function getId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  return typeof value?.id === "string" ? value.id : null;
}

function getSessionCustomerId(session: Stripe.Checkout.Session): string {
  const customerId = getId(session.customer);

  if (!customerId) {
    throw new Error(`Checkout session ${session.id} has no Stripe customer.`);
  }

  return customerId;
}

function getSubscriptionCustomerId(subscription: Stripe.Subscription): string {
  const customerId = getId(subscription.customer);

  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} has no Stripe customer.`);
  }

  return customerId;
}

function getSessionSubscriptionId(session: Stripe.Checkout.Session): string | null {
  return getId(session.subscription);
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  return getId(session.payment_intent);
}

function getLatestInvoiceId(subscription: Stripe.Subscription): string | null {
  return getId(subscription.latest_invoice);
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const timestamp = subscription.items.data[0]?.current_period_end;
  return typeof timestamp === "number" ? stripeTimestampToIso(timestamp) : null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

function isStripeSubscriptionStatus(status: string): status is StripeSubscriptionStatus {
  return STRIPE_SUBSCRIPTION_STATUSES.includes(status as StripeSubscriptionStatus);
}

async function getCheckoutSessionPriceId(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<string> {
  const expandedLineItems = session.line_items?.data ?? [];

  if (expandedLineItems.length > 1 || session.line_items?.has_more) {
    throw new Error(`Checkout session ${session.id} has multiple line items.`);
  }

  const expandedPriceId = expandedLineItems[0]?.price?.id;

  if (expandedPriceId) {
    return expandedPriceId;
  }

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

  if (lineItems.data.length !== 1 || lineItems.has_more) {
    throw new Error(`Checkout session ${session.id} must have exactly one line item.`);
  }

  const listedPriceId = lineItems.data[0]?.price?.id;

  if (!listedPriceId) {
    throw new Error(`Checkout session ${session.id} has no line item price.`);
  }

  return listedPriceId;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as (
    | (Stripe.Invoice.Parent & {
        subscription?: string | Stripe.Subscription | null;
        type?: string;
      })
    | null
  );

  if (parent?.type === "subscription_details" && "subscription" in parent) {
    return getId(parent.subscription);
  }

  const legacyInvoice = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  return getId(legacyInvoice.subscription);
}

async function resolveMappedUserForCustomer(
  admin: AdminClient,
  livemode: boolean,
  customerId: string,
): Promise<{ userId: string } | null> {
  const mapping = await findUserByStripeCustomerId(admin, customerId, livemode);

  if (!mapping) {
    return null;
  }

  return { userId: mapping.user_id };
}

function assertSessionTraceMatchesUser(session: Stripe.Checkout.Session, userId: string): void {
  const metadataUserId = session.metadata?.supabase_user_id;

  if (session.client_reference_id && session.client_reference_id !== userId) {
    throw new Error("Checkout session client_reference_id does not match customer mapping.");
  }

  if (metadataUserId && metadataUserId !== userId) {
    throw new Error("Checkout session metadata user ID does not match customer mapping.");
  }
}

async function applySubscriptionFromStripe(
  admin: AdminClient,
  subscription: Stripe.Subscription,
  event: Stripe.Event,
  context: RouteContext,
): Promise<void> {
  const customerId = getSubscriptionCustomerId(subscription);
  const mappedUser = await resolveMappedUserForCustomer(admin, event.livemode, customerId);

  if (!mappedUser) {
    logRouteError(context, "Skipping subscription event for unknown Stripe customer.", undefined, {
      customerId,
      subscriptionId: subscription.id,
    });
    return;
  }

  if (!isStripeSubscriptionStatus(subscription.status)) {
    throw new Error(`Unsupported Stripe subscription status: ${subscription.status}`);
  }

  const priceId = getSubscriptionPriceId(subscription);
  const approvedPrice = priceId ? getStripePriceById(priceId) : null;
  const approvedSubscriptionPrice =
    approvedPrice?.mode === "subscription" && subscription.items.data.length === 1;
  const baseDecision = getStripeSubscriptionEntitlementDecision(subscription.status);
  const entitlementActive = baseDecision.active && approvedSubscriptionPrice;
  const entitlementReason = entitlementActive
    ? baseDecision.reason
    : approvedSubscriptionPrice || !baseDecision.active
      ? baseDecision.reason
      : "unapproved_subscription_price";

  const result = await applySubscriptionProjection(admin, {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
    customerId,
    entitlementActive,
    entitlementReason,
    eventCreatedAt: stripeTimestampToIso(event.created),
    eventId: event.id,
    latestInvoiceId: getLatestInvoiceId(subscription),
    priceId,
    status: subscription.status,
    subscriptionId: subscription.id,
    userId: mappedUser.userId,
  });

  logRouteInfo(context, "Applied Stripe subscription projection.", {
    applied: result.applied,
    entitlementReason: result.entitlement_reason,
    status: subscription.status,
    subscriptionId: subscription.id,
    userId: mappedUser.userId,
  });
}

async function handleSubscriptionEvent(
  stripe: Stripe,
  admin: AdminClient,
  event: Stripe.Event,
  context: RouteContext,
): Promise<void> {
  const eventSubscription = event.data.object as Stripe.Subscription;
  const subscription =
    event.type === "customer.subscription.deleted"
      ? eventSubscription
      : await stripe.subscriptions.retrieve(eventSubscription.id, {
          expand: ["items.data.price", "latest_invoice"],
        });

  await applySubscriptionFromStripe(admin, subscription, event, context);
}

async function handleInvoiceEvent(
  stripe: Stripe,
  admin: AdminClient,
  event: Stripe.Event,
  context: RouteContext,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    logRouteInfo(context, "Skipping invoice event without subscription.", {
      eventType: event.type,
      invoiceId: invoice.id,
    });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price", "latest_invoice"],
  });

  await applySubscriptionFromStripe(admin, subscription, event, context);
}

async function handleCheckoutSessionEvent(
  stripe: Stripe,
  admin: AdminClient,
  event: Stripe.Event,
  context: RouteContext,
): Promise<void> {
  const eventSession = event.data.object as Stripe.Checkout.Session;
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["line_items", "subscription"],
  });
  const customerId = getSessionCustomerId(session);
  const mappedUser = await resolveMappedUserForCustomer(admin, event.livemode, customerId);

  if (!mappedUser) {
    logRouteError(context, "Skipping checkout session for unknown Stripe customer.", undefined, {
      customerId,
      sessionId: session.id,
    });
    return;
  }

  assertSessionTraceMatchesUser(session, mappedUser.userId);

  const priceId = await getCheckoutSessionPriceId(stripe, session);
  const approvedPrice = getStripePriceById(priceId);

  if (!approvedPrice || approvedPrice.mode !== session.mode) {
    throw new Error(`Checkout session ${session.id} used an unapproved price.`);
  }

  if (session.mode !== "payment" && session.mode !== "subscription") {
    throw new Error(`Checkout session ${session.id} used unsupported mode ${session.mode}.`);
  }

  let accessUntil: string | null = null;

  if (session.mode === "payment") {
    const paymentSucceeded =
      event.type === "checkout.session.async_payment_succeeded" ||
      (event.type === "checkout.session.completed" && session.payment_status === "paid");

    accessUntil = paymentSucceeded
      ? addDays(new Date(event.created * 1000), ONE_TIME_PASS_DAYS).toISOString()
      : null;
  }

  const result = await applyCheckoutSessionProjection(admin, {
    accessUntil,
    customerId,
    eventCreatedAt: stripeTimestampToIso(event.created),
    eventId: event.id,
    livemode: session.livemode,
    mode: session.mode,
    paymentIntentId: getPaymentIntentId(session),
    paymentStatus: session.payment_status,
    priceId,
    priceKey: approvedPrice.key,
    sessionId: session.id,
    status: session.status,
    subscriptionId: getSessionSubscriptionId(session),
    userId: mappedUser.userId,
  });

  logRouteInfo(context, "Applied Stripe checkout session projection.", {
    applied: result.applied,
    entitlementReason: result.entitlement_reason,
    paymentStatus: session.payment_status,
    sessionId: session.id,
    userId: mappedUser.userId,
  });

  if (session.mode === "subscription") {
    const subscriptionId = getSessionSubscriptionId(session);

    if (!subscriptionId) {
      logRouteError(context, "Subscription checkout completed without subscription ID.", undefined, {
        sessionId: session.id,
      });
      return;
    }

    const subscription = typeof session.subscription === "object" && session.subscription
      ? session.subscription
      : await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price", "latest_invoice"],
        });

    await applySubscriptionFromStripe(admin, subscription, event, context);
  }
}

async function processStripeEvent(
  stripe: Stripe,
  admin: AdminClient,
  event: Stripe.Event,
  context: RouteContext,
): Promise<"processed" | "skipped"> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
      await handleCheckoutSessionEvent(stripe, admin, event, context);
      return "processed";

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await handleSubscriptionEvent(stripe, admin, event, context);
      return "processed";

    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.payment_action_required":
    case "invoice.finalization_failed":
      await handleInvoiceEvent(stripe, admin, event, context);
      return "processed";

    case "customer.subscription.trial_will_end":
      logRouteInfo(context, "Received subscription trial ending notification.", {
        subscriptionId: (event.data.object as Stripe.Subscription).id,
      });
      return "processed";

    default:
      logRouteInfo(context, "Skipping unhandled Stripe event type.", {
        eventType: event.type,
      });
      return "skipped";
  }
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
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
    assertEventModeMatchesConfiguredKey(event);
  } catch (error) {
    logRouteError(context, "Webhook signature or mode verification failed.", error);
    return jsonWithContext({ error: "Ogiltig signatur." }, { status: 400 }, context);
  }

  const admin = createAdminClient();
  const claimed = await claimStripeEvent(admin, event);

  logRouteInfo(context, "Received Stripe webhook.", {
    eventId: event.id,
    eventType: event.type,
    processingAttempts: claimed.processing_attempts,
    shouldProcess: claimed.should_process,
    status: claimed.status,
  });

  if (!claimed.should_process) {
    return jsonWithContext({ received: true, duplicate: true }, { status: 200 }, context);
  }

  try {
    const status = await processStripeEvent(stripe, admin, event, context);
    await completeStripeEvent(admin, event.id, status);
  } catch (error) {
    logRouteError(context, "Stripe webhook processing failed.", error, {
      eventId: event.id,
      eventType: event.type,
    });

    try {
      await completeStripeEvent(admin, event.id, "failed", error);
    } catch (completionError) {
      logRouteError(context, "Failed to mark Stripe webhook event as failed.", completionError, {
        eventId: event.id,
      });
    }

    return jsonWithContext({ error: "Webhook processing failed." }, { status: 500 }, context);
  }

  return jsonWithContext({ received: true }, { status: 200 }, context);
}
