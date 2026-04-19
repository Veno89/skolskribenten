"use client";

import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FREE_TRANSFORM_LIMIT,
  formatEntitlementEndDate,
  getCurrentPlanLabel,
  hasExceededFreeTransformLimit,
  isActivePro,
  isRecurringPro,
} from "@/lib/billing/entitlements";
import type { Profile } from "@/types";

interface Props {
  profile: Profile;
  paymentStatus: "success" | "cancelled" | null;
}

export function KontoClient({ profile, paymentStatus }: Props): JSX.Element {
  const [activeCheckout, setActiveCheckout] = useState<"monthly" | "onetime" | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPro = isActivePro(profile);
  const isRecurringPlan = isRecurringPro(profile);
  const quotaExceeded = hasExceededFreeTransformLimit(profile);
  const currentPlanLabel = getCurrentPlanLabel(profile);
  const isBusy = activeCheckout !== null || isOpeningPortal;
  const monthlyActionDisabled = isRecurringPlan ? isBusy : isBusy || isPro;
  const oneTimePassEndsAt = formatEntitlementEndDate(profile.subscription_end_date);

  const handleCheckout = (priceType: "monthly" | "onetime") => {
    setErrorMessage(null);
    setActiveCheckout(priceType);

    startTransition(async () => {
      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ priceType }),
        });

        const payload = (await response.json()) as { error?: string; url?: string };

        if (!response.ok || !payload.url) {
          setErrorMessage(payload.error ?? "Kunde inte starta betalningen.");
          setActiveCheckout(null);
          return;
        }

        window.location.assign(payload.url);
      } catch {
        setErrorMessage("Kunde inte starta betalningen.");
        setActiveCheckout(null);
      }
    });
  };

  const handleOpenPortal = () => {
    setErrorMessage(null);
    setIsOpeningPortal(true);

    startTransition(async () => {
      try {
        const response = await fetch("/api/stripe/portal", {
          method: "POST",
        });

        const payload = (await response.json()) as { error?: string; url?: string };

        if (!response.ok || !payload.url) {
          setErrorMessage(payload.error ?? "Kunde inte öppna kundportalen.");
          setIsOpeningPortal(false);
          return;
        }

        window.location.assign(payload.url);
      } catch {
        setErrorMessage("Kunde inte öppna kundportalen.");
        setIsOpeningPortal(false);
      }
    });
  };

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
              Användning denna månad
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--ss-neutral-900)]">
              {profile.transforms_used_this_month} av {FREE_TRANSFORM_LIMIT} gratis omvandlingar använda
            </p>
          </div>
        </div>

        {paymentStatus === "success" ? (
          <div className="mt-6 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Betalningen registrerades. Ditt konto uppdateras så snart Stripe-webhooken har
            bekräftat köpet.
          </div>
        ) : null}

        {paymentStatus === "cancelled" ? (
          <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Betalningen avbröts. Du kan prova igen när du vill.
          </div>
        ) : null}

        {isRecurringPlan ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-primary)]/20 bg-[var(--ss-primary-light)] px-4 py-4 text-sm text-[var(--ss-neutral-900)]">
            <p className="font-medium">Ditt månadsabonnemang är redan aktivt.</p>
            <p className="mt-2 leading-7">
              Öppna kundportalen för att hantera eller avsluta abonnemanget.
            </p>
            <Button
              type="button"
              onClick={handleOpenPortal}
              disabled={isOpeningPortal || activeCheckout !== null}
              className="mt-4 rounded-full"
            >
              {isOpeningPortal ? "Öppnar kundportalen..." : "Hantera abonnemang"}
            </Button>
          </div>
        ) : null}

        {isPro && !isRecurringPlan && oneTimePassEndsAt ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-secondary)] bg-[var(--ss-secondary-light)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
            Ditt 30-dagarskort är aktivt till {oneTimePassEndsAt}. När perioden löpt ut kan du välja
            ett nytt kort eller månadsabonnemang.
          </div>
        ) : null}

        {quotaExceeded ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-accent)] bg-[var(--ss-accent-soft)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
            Du har använt dina {FREE_TRANSFORM_LIMIT} gratis omvandlingar den här månaden. Uppgradera
            för att fortsätta.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-6 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">
            Månadsabonnemang
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--ss-neutral-900)]">
            Pro - Obegränsade omvandlingar, 49 kr/mån
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Ingen bindningstid. Avsluta när som helst i kundportalen.
          </p>
          <Button
            type="button"
            onClick={isRecurringPlan ? handleOpenPortal : () => handleCheckout("monthly")}
            disabled={monthlyActionDisabled}
            className="mt-8 w-full rounded-full"
          >
            {isRecurringPlan
              ? isOpeningPortal
                ? "Öppnar kundportalen..."
                : "Hantera abonnemang"
              : activeCheckout === "monthly"
                ? "Startar betalning..."
                : isPro
                  ? "Pro redan aktivt"
                  : "Välj månadsabonnemang"}
          </Button>
        </article>

        <article className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">Engångsköp</p>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--ss-neutral-900)]">
            30-dagarskort - Obegränsade omvandlingar i 30 dagar, 49 kr
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">Förnyas inte automatiskt.</p>
          <Button
            type="button"
            onClick={() => handleCheckout("onetime")}
            disabled={isBusy || isPro}
            variant="secondary"
            className="mt-8 w-full rounded-full"
          >
            {activeCheckout === "onetime"
              ? "Startar betalning..."
              : isPro
                ? "Pro redan aktivt"
                : "Välj 30-dagarskort"}
          </Button>
        </article>
      </section>
    </div>
  );
}
