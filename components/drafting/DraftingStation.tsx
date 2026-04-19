"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import { OutputPanel } from "@/components/drafting/OutputPanel";
import { TemplatePicker } from "@/components/drafting/TemplatePicker";
import { UsageCounter } from "@/components/drafting/UsageCounter";
import { GdprBadge } from "@/components/gdpr/GdprBadge";
import { GdprNameInput } from "@/components/gdpr/GdprNameInput";
import { useCompletion } from "@/hooks/useCompletion";
import { GdprScrubber } from "@/lib/gdpr/scrubber";
import { parseUserSettings } from "@/lib/validations/user-settings";
import type { Profile, ScrubberStats, TemplateType } from "@/types";

const scrubber = new GdprScrubber();
const DEFAULT_TEMPLATE: TemplateType = "larlogg";
const SCHOOL_LEVEL_LABELS = {
  "F-3": "F-3",
  "4-6": "4-6",
  "7-9": "7-9",
} as const;
const TONE_LABELS = {
  formal: "Formell ton",
  warm: "Varm ton",
} as const;
const FIRST_RUN_PLACEHOLDER = `Exempeltext: "Eleven hade svårt att sitta still under matematiklektionen och
störde de andra eleverna tre gånger. Vi pratade efteråt och kom överens om att
eleven ska sitta närmast tavlan nästa vecka. Elevens föräldrar informerades."

Välj mall och klicka "Generera" - texten ovan är bara ett exempel, skriv din egen.`;

interface Props {
  userProfile: Profile;
}

export function DraftingStation({ userProfile }: Props): JSX.Element {
  const [rawInput, setRawInput] = useState("");
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(DEFAULT_TEMPLATE);
  const [scrubberStats, setScrubberStats] = useState<ScrubberStats | null>(null);
  const [unmatchedWarnings, setUnmatchedWarnings] = useState<string[]>([]);
  const userSettings = parseUserSettings(userProfile.user_settings);
  const activePreferences = [
    userSettings.schoolLevel ? `Årskurs ${SCHOOL_LEVEL_LABELS[userSettings.schoolLevel]}` : null,
    userSettings.preferredTone ? TONE_LABELS[userSettings.preferredTone] : null,
  ].filter((value): value is string => Boolean(value));

  const { complete, completion, isLoading, error } = useCompletion({
    api: "/api/ai",
  });

  const handleGenerate = async () => {
    if (!rawInput.trim()) {
      return;
    }

    const result = scrubber.scrub(rawInput, { customNames });

    setScrubberStats(result.stats);
    setUnmatchedWarnings(result.unmatchedCapitalized);

    await complete("", {
      body: {
        templateType: selectedTemplate,
        scrubbedInput: result.scrubbedText,
        scrubberStats: result.stats,
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ss-neutral-50)]">
      <header className="ss-surface sticky top-0 z-10 flex flex-col gap-4 border-b border-white/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--ss-primary)]">Skrivstation</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--ss-neutral-900)]">
              Dokumentera med lugn och kontroll
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {activePreferences.length > 0
                ? `Aktiva skrivinställningar: ${activePreferences.join(" · ")}.`
                : "Lägg till skolnivå och ton i Inställningar för mer träffsäkra utkast."}
            </p>
          </div>
          <TemplatePicker value={selectedTemplate} onChange={setSelectedTemplate} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full border-white/70 bg-white/80"
          >
            <Link href="/installningar">Inställningar</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full border-white/70 bg-white/80"
          >
            <Link href="/konto">Konto</Link>
          </Button>
          <SignOutButton
            size="sm"
            variant="outline"
            className="rounded-full border-white/70 bg-white/80"
          />
          <UsageCounter profile={userProfile} />
          <GdprBadge stats={scrubberStats} />
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex w-full flex-col border-b border-[var(--ss-neutral-200)] lg:w-1/2 lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--ss-neutral-100)] bg-white px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--ss-neutral-800)]">
              Dina anteckningar
            </span>
          </div>

          <GdprNameInput value={customNames} onChange={setCustomNames} />

          <textarea
            className="min-h-[24rem] flex-1 resize-none bg-[var(--ss-neutral-50)] px-4 py-5 text-sm leading-7 text-[var(--ss-neutral-900)] placeholder:text-[var(--ss-neutral-300)] focus:outline-none"
            placeholder={FIRST_RUN_PLACEHOLDER}
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
          />

          {unmatchedWarnings.length > 0 ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
              ⚠ Dessa ord kan vara namn som inte kändes igen automatiskt:{" "}
              <strong>{unmatchedWarnings.join(", ")}</strong>. Lägg till dem i namnlistan ovan om
              det stämmer.
            </div>
          ) : null}

          <div className="border-t border-[var(--ss-neutral-100)] bg-white p-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !rawInput.trim()}
              className="w-full rounded-2xl bg-[var(--ss-primary)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Genererar..." : "Generera dokument →"}
            </button>
          </div>
        </div>

        <div className="w-full lg:w-1/2">
          <OutputPanel
            completion={completion}
            isLoading={isLoading}
            error={error?.message}
            templateType={selectedTemplate}
          />
        </div>
      </div>
    </div>
  );
}
