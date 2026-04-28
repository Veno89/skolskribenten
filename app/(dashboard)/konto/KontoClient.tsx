import { KontoBillingActions } from "@/app/(dashboard)/konto/KontoBillingActions";
import type { BillingPricingConfig } from "@/lib/billing/pricing-config";

interface Props {
  billingState: {
    currentPlanLabel: string;
    debug: {
      entitlementReason: string;
      lastReconciledAt: string | null;
      lastStripeEventId: string | null;
      localAccessLevel: string;
      localSource: string;
      stripeCheckoutSessionId: string | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
    };
    isPro: boolean;
    isRecurringPlan: boolean;
    oneTimePassEndsAt: string | null;
    pricing: BillingPricingConfig;
    quotaExceeded: boolean;
    quotaExceededMessage: string;
    usageSummary: string;
  };
  paymentStatus: "success" | "cancelled" | null;
}

export function KontoClient({ billingState, paymentStatus }: Props): JSX.Element {
  const {
    currentPlanLabel,
    debug,
    isPro,
    isRecurringPlan,
    oneTimePassEndsAt,
    pricing,
    quotaExceeded,
    quotaExceededMessage,
    usageSummary,
  } = billingState;

  return (
    <div className="space-y-8">
      <section className="ss-card p-8">
        <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Konto</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
          Ditt abonnemang i klartext
        </h1>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] bg-[var(--ss-neutral-50)] p-5">
            <p className="text-sm font-medium text-muted-foreground">Aktuell plan</p>
            <p className="mt-2 text-xl font-semibold text-[var(--ss-neutral-900)]">
              {currentPlanLabel}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[var(--ss-primary-light)] p-5">
            <p className="text-sm font-medium text-[var(--ss-primary-dark)]">
              AnvÃ¤ndning denna mÃ¥nad
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--ss-neutral-900)]">
              {usageSummary}
            </p>
          </div>
        </div>

        {paymentStatus === "success" ? (
          <div className="mt-6 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Betalningen registrerades. Ditt konto uppdateras sÃ¥ snart Stripe-webhooken har
            bekrÃ¤ftat kÃ¶pet.
          </div>
        ) : null}

        {paymentStatus === "cancelled" ? (
          <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Betalningen avbrÃ¶ts. Du kan prova igen nÃ¤r du vill.
          </div>
        ) : null}

        {isPro && !isRecurringPlan && oneTimePassEndsAt ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-secondary)] bg-[var(--ss-secondary-light)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
            Ditt {pricing.oneTimePassDurationDays}-dagarskort Ã¤r aktivt till {oneTimePassEndsAt}. NÃ¤r perioden lÃ¶pt ut kan du vÃ¤lja
            ett nytt kort eller mÃ¥nadsabonnemang.
          </div>
        ) : null}

        {quotaExceeded ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-accent)] bg-[var(--ss-accent-soft)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
            {quotaExceededMessage}
          </div>
        ) : null}
      </section>

      <section className="ss-card p-6">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-[var(--ss-neutral-900)]">
            Teknisk betalningsstatus
          </summary>
          <dl className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">
                {"Lokal \u00e5tkomst"}
              </dt>
              <dd>{debug.localAccessLevel}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">{"K\u00e4lla"}</dt>
              <dd>{debug.localSource}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">Orsak</dt>
              <dd>{debug.entitlementReason}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">
                {"Senast avst\u00e4md"}
              </dt>
              <dd>{debug.lastReconciledAt ?? "Inte avst\u00e4md"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">Stripe-kund</dt>
              <dd>{debug.stripeCustomerId ?? "Saknas"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">Stripe-abonnemang</dt>
              <dd>{debug.stripeSubscriptionId ?? "Saknas"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">Checkout-session</dt>
              <dd>{debug.stripeCheckoutSessionId ?? "Saknas"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ss-neutral-900)]">Senaste Stripe-event</dt>
              <dd>{debug.lastStripeEventId ?? "Saknas"}</dd>
            </div>
          </dl>
        </details>
      </section>

      <KontoBillingActions isPro={isPro} isRecurringPlan={isRecurringPlan} pricing={pricing} />
    </div>
  );
}
