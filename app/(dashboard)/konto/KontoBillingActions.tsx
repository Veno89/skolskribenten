"use client";

import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MONTHLY_PRO_PRICE_SEK,
  ONE_TIME_PASS_DURATION_DAYS,
  ONE_TIME_PASS_PRICE_SEK,
  PAID_TRANSFORM_LIMIT,
} from "@/lib/billing/entitlements";

interface Props {
  isPro: boolean;
  isRecurringPlan: boolean;
}

export function KontoBillingActions({ isPro, isRecurringPlan }: Props): JSX.Element {
  const [activeCheckout, setActiveCheckout] = useState<"monthly" | "onetime" | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = activeCheckout !== null || isOpeningPortal;
  const monthlyActionDisabled = isRecurringPlan ? isBusy : isBusy || isPro;

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
    <>
      {isRecurringPlan ? (
        <div className="rounded-[1.25rem] border border-[var(--ss-primary)]/20 bg-[var(--ss-primary-light)] px-4 py-4 text-sm text-[var(--ss-neutral-900)]">
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

      {errorMessage ? (
        <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">
            Månadsabonnemang
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--ss-neutral-900)]">
            Pro - {PAID_TRANSFORM_LIMIT} omvandlingar per månad, {MONTHLY_PRO_PRICE_SEK} kr/mån
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
            {ONE_TIME_PASS_DURATION_DAYS}-dagarskort - {PAID_TRANSFORM_LIMIT} omvandlingar per månad i{" "}
            {ONE_TIME_PASS_DURATION_DAYS} dagar, {ONE_TIME_PASS_PRICE_SEK} kr
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
    </>
  );
}
