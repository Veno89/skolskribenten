import type Stripe from "stripe";
import type { Json } from "@/types/database";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

interface ClaimStripeEventResult {
  should_process: boolean;
  status: string;
  processing_attempts: number;
}

interface ProjectionResult {
  applied: boolean;
  entitlement_access_level: string;
  entitlement_reason: string;
}

export interface StripeCustomerMapping {
  livemode: boolean;
  stripe_customer_id: string;
  user_id: string;
}

function toIsoFromStripeTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

function getStripeObjectId(event: Stripe.Event): string | null {
  const stripeObject = event.data.object as { id?: unknown };
  return typeof stripeObject.id === "string" ? stripeObject.id : null;
}

function getStripeObjectValue(object: Record<string, unknown>, key: string): Json | undefined {
  const value = object[key];

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (typeof value === "object" && value && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }

  return undefined;
}

function buildStripeEventLedgerPayload(event: Stripe.Event): Json {
  const object = event.data.object as unknown as Record<string, unknown>;
  const objectKeys = [
    "id",
    "object",
    "customer",
    "subscription",
    "payment_intent",
    "latest_invoice",
    "status",
    "payment_status",
  ];
  const sanitizedObject = Object.fromEntries(
    objectKeys
      .map((key) => [key, getStripeObjectValue(object, key)] as const)
      .filter((entry): entry is readonly [string, Json] => entry[1] !== undefined),
  );

  return {
    created: event.created,
    data: {
      object: sanitizedObject,
    },
    id: event.id,
    livemode: event.livemode,
    type: event.type,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "Unknown error";
  }

  return "Unknown error";
}

export async function recordStripeCustomerMapping(
  admin: AdminClient,
  params: {
    customerId: string;
    livemode: boolean;
    userId: string;
  },
): Promise<StripeCustomerMapping> {
  const { data, error } = await admin
    .rpc("record_stripe_customer_mapping", {
      p_livemode: params.livemode,
      p_stripe_customer_id: params.customerId,
      p_user_id: params.userId,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to record Stripe customer mapping: ${errorMessage(error)}`);
  }

  return data;
}

export async function findUserByStripeCustomerId(
  admin: AdminClient,
  customerId: string,
  livemode?: boolean,
): Promise<StripeCustomerMapping | null> {
  const { data: mapping, error: mappingError } = await admin
    .from("stripe_customer_mappings")
    .select("user_id, stripe_customer_id, livemode")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (mappingError) {
    throw new Error(`Failed to load Stripe customer mapping: ${errorMessage(mappingError)}`);
  }

  if (mapping) {
    return mapping;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load legacy Stripe customer mapping: ${errorMessage(profileError)}`);
  }

  if (!profile?.stripe_customer_id) {
    return null;
  }

  return livemode === undefined
    ? {
        livemode: false,
        stripe_customer_id: profile.stripe_customer_id,
        user_id: profile.id,
      }
    : recordStripeCustomerMapping(admin, {
        customerId: profile.stripe_customer_id,
        livemode,
        userId: profile.id,
      });
}

export async function findStripeCustomerMappingByUserId(
  admin: AdminClient,
  userId: string,
): Promise<StripeCustomerMapping | null> {
  const { data, error } = await admin
    .from("stripe_customer_mappings")
    .select("user_id, stripe_customer_id, livemode")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe customer mapping: ${errorMessage(error)}`);
  }

  return data ?? null;
}

export async function claimStripeEvent(
  admin: AdminClient,
  event: Stripe.Event,
): Promise<ClaimStripeEventResult> {
  const { data, error } = await admin
    .rpc("claim_stripe_event", {
      p_event_type: event.type,
      p_livemode: event.livemode,
      p_object_id: getStripeObjectId(event),
      p_payload: buildStripeEventLedgerPayload(event),
      p_stripe_created_at: toIsoFromStripeTimestamp(event.created),
      p_stripe_event_id: event.id,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to claim Stripe event: ${errorMessage(error)}`);
  }

  return data;
}

export async function completeStripeEvent(
  admin: AdminClient,
  eventId: string,
  status: "processed" | "failed" | "skipped",
  error?: unknown,
): Promise<void> {
  const { error: rpcError } = await admin.rpc("complete_stripe_event", {
    p_error_message: error ? errorMessage(error) : null,
    p_status: status,
    p_stripe_event_id: eventId,
  });

  if (rpcError) {
    throw new Error(`Failed to complete Stripe event: ${errorMessage(rpcError)}`);
  }
}

export async function recordCheckoutSessionCreated(
  admin: AdminClient,
  params: {
    customerId: string;
    livemode: boolean;
    mode: "payment" | "subscription";
    paymentStatus: string | null;
    priceId: string;
    priceKey: string;
    sessionId: string;
    status: string | null;
    userId: string;
  },
): Promise<void> {
  const { error } = await admin.rpc("record_checkout_session_created", {
    p_livemode: params.livemode,
    p_mode: params.mode,
    p_payment_status: params.paymentStatus,
    p_price_key: params.priceKey,
    p_status: params.status,
    p_stripe_checkout_session_id: params.sessionId,
    p_stripe_customer_id: params.customerId,
    p_stripe_price_id: params.priceId,
    p_user_id: params.userId,
  });

  if (error) {
    throw new Error(`Failed to record checkout session: ${errorMessage(error)}`);
  }
}

export async function applyCheckoutSessionProjection(
  admin: AdminClient,
  params: {
    accessUntil: string | null;
    customerId: string;
    eventCreatedAt: string;
    eventId: string;
    livemode: boolean;
    mode: "payment" | "subscription";
    paymentIntentId: string | null;
    paymentStatus: string | null;
    priceId: string;
    priceKey: string;
    sessionId: string;
    status: string | null;
    subscriptionId: string | null;
    userId: string;
  },
): Promise<ProjectionResult> {
  const { data, error } = await admin
    .rpc("apply_checkout_session_projection", {
      p_access_until: params.accessUntil,
      p_event_created_at: params.eventCreatedAt,
      p_event_id: params.eventId,
      p_livemode: params.livemode,
      p_mode: params.mode,
      p_payment_status: params.paymentStatus,
      p_price_key: params.priceKey,
      p_status: params.status,
      p_stripe_checkout_session_id: params.sessionId,
      p_stripe_customer_id: params.customerId,
      p_stripe_payment_intent_id: params.paymentIntentId,
      p_stripe_price_id: params.priceId,
      p_stripe_subscription_id: params.subscriptionId,
      p_user_id: params.userId,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to apply checkout projection: ${errorMessage(error)}`);
  }

  return data;
}

export async function applySubscriptionProjection(
  admin: AdminClient,
  params: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    customerId: string;
    entitlementActive: boolean;
    entitlementReason: string;
    eventCreatedAt: string;
    eventId: string;
    latestInvoiceId: string | null;
    paidAccessUntil?: string | null;
    priceId: string | null;
    reconciledAt?: string | null;
    status: string;
    subscriptionId: string;
    userId: string;
  },
): Promise<ProjectionResult> {
  const { data, error } = await admin
    .rpc("apply_subscription_projection", {
      p_cancel_at_period_end: params.cancelAtPeriodEnd,
      p_current_period_end: params.currentPeriodEnd,
      p_entitlement_active: params.entitlementActive,
      p_entitlement_reason: params.entitlementReason,
      p_event_created_at: params.eventCreatedAt,
      p_event_id: params.eventId,
      p_latest_invoice_id: params.latestInvoiceId,
      p_paid_access_until: params.paidAccessUntil ?? null,
      p_reconciled_at: params.reconciledAt ?? null,
      p_stripe_customer_id: params.customerId,
      p_stripe_price_id: params.priceId,
      p_stripe_status: params.status,
      p_stripe_subscription_id: params.subscriptionId,
      p_user_id: params.userId,
    })
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to apply subscription projection: ${errorMessage(error)}`);
  }

  return data;
}
