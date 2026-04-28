import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const repair = process.argv.includes("--repair");
const now = new Date().toISOString();
const pastDueGracePeriodMs = 7 * 24 * 60 * 60 * 1000;

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAdminKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function subscriptionDecision(status, approvedPrice, pastDueSince) {
  if (!approvedPrice) {
    return {
      active: false,
      paidAccessUntil: null,
      reason: "reconcile_unapproved_subscription_price",
    };
  }
  if (status === "active") {
    return {
      active: true,
      paidAccessUntil: null,
      reason: "reconcile_stripe_subscription_active",
    };
  }
  if (status === "trialing") {
    return {
      active: true,
      paidAccessUntil: null,
      reason: "reconcile_stripe_subscription_trialing",
    };
  }
  if (status === "past_due") {
    if (!pastDueSince) {
      return {
        active: false,
        paidAccessUntil: null,
        reason: "reconcile_stripe_subscription_past_due_missing_grace_anchor",
      };
    }

    const graceEndsAt = new Date(pastDueSince).getTime() + pastDueGracePeriodMs;

    if (new Date(now).getTime() < graceEndsAt) {
      return {
        active: true,
        paidAccessUntil: new Date(graceEndsAt).toISOString(),
        reason: "reconcile_stripe_subscription_past_due_grace_period",
      };
    }

    return {
      active: false,
      paidAccessUntil: null,
      reason: "reconcile_stripe_subscription_past_due_grace_expired",
    };
  }

  return {
    active: false,
    paidAccessUntil: null,
    reason: `reconcile_stripe_subscription_${status}`,
  };
}

function getSubscriptionPriceId(subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function getCurrentPeriodEnd(subscription) {
  const timestamp = subscription.items?.data?.[0]?.current_period_end;
  return typeof timestamp === "number" ? new Date(timestamp * 1000).toISOString() : null;
}

function getLatestInvoiceId(subscription) {
  const invoice = subscription.latest_invoice;
  if (!invoice) return null;
  return typeof invoice === "string" ? invoice : invoice.id;
}

function getLatestInvoiceCreatedAt(subscription) {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string" || typeof invoice.created !== "number") return null;
  return new Date(invoice.created * 1000).toISOString();
}

const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
const monthlyPriceId = requiredEnv("STRIPE_PRICE_MONTHLY_PRO");
const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAdminKey = getAdminKey();

if (!supabaseAdminKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
}

const stripe = new Stripe(stripeSecretKey);
const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { data: mappings, error: mappingsError } = await supabase
  .from("stripe_customer_mappings")
  .select("user_id, stripe_customer_id, livemode")
  .order("created_at", { ascending: true });

if (mappingsError) {
  throw new Error(`Failed to load Stripe customer mappings: ${mappingsError.message}`);
}

console.log(JSON.stringify({
  checkedAt: now,
  customerMappings: mappings?.length ?? 0,
  mode: repair ? "repair" : "dry-run",
}));

for (const mapping of mappings ?? []) {
  const subscriptions = await stripe.subscriptions.list({
    customer: mapping.stripe_customer_id,
    expand: ["data.items.data.price", "data.latest_invoice"],
    limit: 100,
    status: "all",
  });

  const sortedSubscriptions = [...subscriptions.data].sort((left, right) => right.created - left.created);
  const subscription = sortedSubscriptions[0] ?? null;

  if (!subscription) {
    console.log(JSON.stringify({
      action: "no_subscription_found",
      stripeCustomerId: mapping.stripe_customer_id,
      userId: mapping.user_id,
    }));
    continue;
  }

  const priceId = getSubscriptionPriceId(subscription);
  const approvedPrice = priceId === monthlyPriceId;
  const decision = subscriptionDecision(
    subscription.status,
    approvedPrice,
    getLatestInvoiceCreatedAt(subscription),
  );
  const payload = {
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_current_period_end: getCurrentPeriodEnd(subscription),
    p_entitlement_active: decision.active,
    p_entitlement_reason: decision.reason,
    p_event_created_at: now,
    p_event_id: `reconcile:${subscription.id}:${Date.now()}`,
    p_latest_invoice_id: getLatestInvoiceId(subscription),
    p_paid_access_until: decision.active ? decision.paidAccessUntil : null,
    p_reconciled_at: now,
    p_stripe_customer_id: mapping.stripe_customer_id,
    p_stripe_price_id: priceId,
    p_stripe_status: subscription.status,
    p_stripe_subscription_id: subscription.id,
    p_user_id: mapping.user_id,
  };

  console.log(JSON.stringify({
    approvedPrice,
    entitlementActive: decision.active,
    repair,
    status: subscription.status,
    stripeCustomerId: mapping.stripe_customer_id,
    stripePriceId: priceId,
    stripeSubscriptionId: subscription.id,
    userId: mapping.user_id,
  }));

  if (!repair) {
    continue;
  }

  const { error } = await supabase.rpc("apply_subscription_projection", payload);

  if (error) {
    console.error(JSON.stringify({
      error: error.message,
      stripeSubscriptionId: subscription.id,
      userId: mapping.user_id,
    }));
    process.exitCode = 1;
  }
}
