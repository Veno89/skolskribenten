"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TemplateType } from "@/types";

const STORAGE_PREFIX = "skolskribenten:drafting-onboarding-dismissed";
const sampleTemplate: TemplateType = "larlogg";
const sampleInput =
  "Under arbetet med bråk kunde eleven förklara hur hen tänkte när uppgiften blev svårare. Eleven bad om stöd vid jämförelser men visade god uthållighet och tog hjälp av konkret material. Nästa steg är att fortsätta jämföra bråk med olika nämnare i par och använda tallinje som stöd.";

interface Props {
  hasSavedDraft: boolean;
  onDismiss: () => void;
  onUseSample: (sample: { input: string; template: TemplateType }) => void;
  userId: string;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function DraftingOnboardingPanel({
  hasSavedDraft,
  onDismiss,
  onUseSample,
  userId,
}: Props): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsVisible(window.localStorage.getItem(getStorageKey(userId)) !== "true");
    setHasHydrated(true);
  }, [userId]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getStorageKey(userId), "true");
    }

    setIsVisible(false);
    onDismiss();
  };

  const useSample = () => {
    onUseSample({
      input: sampleInput,
      template: sampleTemplate,
    });
    dismiss();
  };

  if (!hasHydrated || !isVisible || hasSavedDraft) {
    return null;
  }

  return (
    <section className="border-b border-[var(--ss-neutral-100)] bg-white px-4 py-4">
      <div className="rounded-lg border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ss-primary)]">
              Välkommen
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--ss-neutral-900)]">
              Prova Skrivstationen med ett tryggt exempel
            </h2>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground md:grid-cols-3">
              <li>1. Välj mall.</li>
              <li>2. Lägg till elevnamn i GDPR-skölden vid behov.</li>
              <li>3. Generera och kopiera utkastet.</li>
            </ol>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" onClick={useSample} className="rounded-full">
              Ladda exempel
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={dismiss} className="rounded-full">
              Stäng
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
