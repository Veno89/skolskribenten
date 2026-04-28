import type { Metadata } from "next";
import { KontoClient } from "@/app/(dashboard)/konto/KontoClient";
import { MissingProfileState } from "@/components/dashboard/MissingProfileState";
import {
  formatEntitlementEndDate,
  getAuthoritativeEntitlementDecision,
  getEntitlementDecision,
  getCurrentPlanLabel,
  getQuotaExceededMessage,
  getUsageSummary,
  hasExceededTransformLimit,
} from "@/lib/billing/entitlements";
import { getBillingPricingConfig } from "@/lib/billing/pricing";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Konto",
  description: "Hantera ditt abonnemang, se användning och uppgradera till Pro.",
};

interface Props {
  searchParams?: {
    payment?: string | string[];
  };
}

export default async function KontoPage({ searchParams }: Props): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/konto" });

  if (!profile) {
    return <MissingProfileState />;
  }

  const supabase = createClient();
  const pricing = getBillingPricingConfig();
  const entitlementCheckedAt = new Date();
  const { data: entitlement } = await supabase
    .from("account_entitlements")
    .select(
      "access_level, source, reason, paid_access_until, stripe_subscription_id, stripe_checkout_session_id, last_stripe_event_id, last_reconciled_at",
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  const paymentParam = Array.isArray(searchParams?.payment)
    ? searchParams.payment[0]
    : searchParams?.payment;
  const paymentStatus =
    paymentParam === "success" || paymentParam === "cancelled" ? paymentParam : null;
  const authoritativeDecision = entitlement
    ? getAuthoritativeEntitlementDecision(entitlement, entitlementCheckedAt)
    : getEntitlementDecision(profile, entitlementCheckedAt);
  const isPro = authoritativeDecision.active;
  const isRecurringPlan = authoritativeDecision.recurring;
  const entitlementProfile = {
    ...profile,
    subscription_end_date:
      authoritativeDecision.source === "one_time_pass" ? authoritativeDecision.paidAccessUntil : null,
    subscription_status: authoritativeDecision.active ? "pro" as const : "free" as const,
  };

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-16 lg:px-8">
      <KontoClient
        paymentStatus={paymentStatus}
        billingState={{
          currentPlanLabel: getCurrentPlanLabel(entitlementProfile, entitlementCheckedAt, pricing),
          isPro,
          isRecurringPlan,
          oneTimePassEndsAt: formatEntitlementEndDate(authoritativeDecision.paidAccessUntil),
          pricing,
          quotaExceeded: hasExceededTransformLimit(entitlementProfile, entitlementCheckedAt),
          quotaExceededMessage: getQuotaExceededMessage(entitlementProfile, entitlementCheckedAt),
          usageSummary: getUsageSummary(entitlementProfile, entitlementCheckedAt),
          debug: {
            entitlementReason: authoritativeDecision.reason,
            lastReconciledAt: entitlement?.last_reconciled_at ?? null,
            lastStripeEventId: entitlement?.last_stripe_event_id ?? null,
            localAccessLevel: authoritativeDecision.accessLevel,
            localSource: authoritativeDecision.source,
            stripeCheckoutSessionId: entitlement?.stripe_checkout_session_id ?? null,
            stripeCustomerId: profile.stripe_customer_id,
            stripeSubscriptionId: entitlement?.stripe_subscription_id ?? null,
          },
        }}
      />
    </main>
  );
}
