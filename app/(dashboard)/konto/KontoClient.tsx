"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

const FREE_LIMIT = 10;

interface Props {
  profile: Profile;
  paymentStatus: "success" | "cancelled" | null;
}

export function KontoClient({ profile, paymentStatus }: Props): JSX.Element {
  const [activeCheckout, setActiveCheckout] = useState<"monthly" | "onetime" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPro =
    profile.subscription_status === "pro" &&
    (profile.subscription_end_date === null ||
      new Date(profile.subscription_end_date) > new Date());
  const quotaExceeded = !isPro && profile.transforms_used_this_month >= FREE_LIMIT;
  const currentPlanLabel = isPro
    ? profile.subscription_end_date === null
      ? "Pro — Obegränsade omvandlingar, 49 kr/mån"
      : "30-dagarskort — Obegränsade omvandlingar i 30 dagar, 49 kr"
    : "Gratis — 10 omvandlingar per månad";

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

  return (
    <div className="space-y-8">
      <section className="ss-card p-8">
        <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Konto</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
          Ditt abonnemang i klartext
        </h1>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/skrivstation">Till skrivstationen</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/installningar">Inställningar</Link>
          </Button>
          <SignOutButton className="rounded-full" />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] bg-[var(--ss-neutral-50)] p-5">
            <p className="text-sm font-medium text-muted-foreground">Aktuell plan</p>
            <p className="mt-2 text-xl font-semibold text-[var(--ss-neutral-900)]">{currentPlanLabel}</p>
          </div>
          <div className="rounded-[1.5rem] bg-[var(--ss-primary-light)] p-5">
            <p className="text-sm font-medium text-[var(--ss-primary-dark)]">Användning denna månad</p>
            <p className="mt-2 text-xl font-semibold text-[var(--ss-neutral-900)]">
              {profile.transforms_used_this_month} av {FREE_LIMIT} gratis omvandlingar använda
            </p>
          </div>
        </div>

        {paymentStatus === "success" ? (
          <div className="mt-6 rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Betalningen registrerades. Ditt konto uppdateras så snart Stripe-webhooken har bekräftat köpet.
          </div>
        ) : null}

        {paymentStatus === "cancelled" ? (
          <div className="mt-6 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Betalningen avbröts. Du kan prova igen när du vill.
          </div>
        ) : null}

        {quotaExceeded ? (
          <div className="mt-6 rounded-[1.25rem] border border-[var(--ss-accent)] bg-[var(--ss-accent-soft)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
            Du har använt dina 10 gratis omvandlingar den här månaden. Uppgradera för att fortsätta.
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
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">Månadsabonnemang</p>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--ss-neutral-900)]">
            Pro — Obegränsade omvandlingar, 49 kr/mån
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Ingen bindningstid. Avsluta när som helst.
          </p>
          <Button
            type="button"
            onClick={() => handleCheckout("monthly")}
            disabled={activeCheckout !== null}
            className="mt-8 w-full rounded-full"
          >
            {activeCheckout === "monthly" ? "Startar betalning..." : "Välj månadsabonnemang"}
          </Button>
        </article>

        <article className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">Engångsköp</p>
          <h2 className="mt-4 text-2xl font-semibold text-[var(--ss-neutral-900)]">
            30-dagarskort — Obegränsade omvandlingar i 30 dagar, 49 kr
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">Förnyas inte automatiskt.</p>
          <Button
            type="button"
            onClick={() => handleCheckout("onetime")}
            disabled={activeCheckout !== null}
            variant="secondary"
            className="mt-8 w-full rounded-full"
          >
            {activeCheckout === "onetime" ? "Startar betalning..." : "Välj 30-dagarskort"}
          </Button>
        </article>
      </section>
    </div>
  );
}
