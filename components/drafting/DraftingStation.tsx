"use client";

import Link from "next/link";
import { DraftingHeader } from "@/components/drafting/DraftingHeader";
import { OutputPanel } from "@/components/drafting/OutputPanel";
import { GdprNameInput } from "@/components/gdpr/GdprNameInput";
import { Button } from "@/components/ui/button";
import { useDocumentGeneration } from "@/hooks/useDocumentGeneration";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import {
  getQuotaExceededMessage,
  hasExceededTransformLimit,
} from "@/lib/billing/entitlements";
import { TEMPLATE_DETAILS } from "@/lib/drafting/template-content";
import {
  parseUserSettings,
  SCHOOL_LEVEL_LABELS,
  TONE_LABELS,
} from "@/lib/validations/user-settings";
import type { Profile } from "@/types";

interface Props {
  userProfile: Profile;
}

export function DraftingStation({ userProfile }: Props): JSX.Element {
  const userSettings = parseUserSettings(userProfile.user_settings);
  const {
    clearActiveDraft,
    customNames,
    hasSavedDraft,
    rawInput,
    savedAtLabel,
    selectedTemplate,
    switchTemplate,
    updateCustomNames,
    updateRawInput,
  } = useDraftPersistence(userProfile.id);
  const {
    completion,
    error,
    generateDocument,
    isLoading,
    resetGenerationState,
    scrubberStats,
    unmatchedWarnings,
  } = useDocumentGeneration();

  const activePreferences = [
    userSettings.schoolLevel ? `Årskurs ${SCHOOL_LEVEL_LABELS[userSettings.schoolLevel]}` : null,
    userSettings.preferredTone ? TONE_LABELS[userSettings.preferredTone] : null,
  ].filter((value): value is string => Boolean(value));
  const selectedTemplateInfo = TEMPLATE_DETAILS[selectedTemplate];
  const quotaExceeded = hasExceededTransformLimit(userProfile);
  const quotaExceededMessage = getQuotaExceededMessage(userProfile);

  const handleTemplateChange = (nextTemplate: typeof selectedTemplate) => {
    if (switchTemplate(nextTemplate)) {
      resetGenerationState();
    }
  };

  const handleClearDraft = () => {
    clearActiveDraft();
    resetGenerationState();
  };

  const handleGenerate = async () => {
    await generateDocument({
      customNames,
      rawInput,
      templateType: selectedTemplate,
    });
  };

  return (
    <div id="main-content" className="flex min-h-screen flex-col bg-[var(--ss-neutral-50)]">
      <DraftingHeader
        activePreferences={activePreferences}
        onTemplateChange={handleTemplateChange}
        selectedTemplate={selectedTemplate}
        stats={scrubberStats}
        userProfile={userProfile}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex w-full flex-col border-b border-[var(--ss-neutral-200)] lg:w-1/2 lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--ss-neutral-100)] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--ss-neutral-800)]">
                  Dina anteckningar
                </span>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Aktiv mall: {selectedTemplateInfo.label}
                </p>
              </div>
              <div className="rounded-full bg-[var(--ss-primary-light)] px-3 py-1 text-xs font-medium text-[var(--ss-primary-dark)]">
                {selectedTemplateInfo.eyebrow}
              </div>
            </div>
          </div>

          <GdprNameInput value={customNames} onChange={updateCustomNames} />

          <div className="border-b border-[var(--ss-neutral-100)] bg-white px-4 py-3">
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--ss-neutral-900)]">
                  Utkast sparas tillfälligt lokalt
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {savedAtLabel
                    ? `Senast sparat lokalt kl. ${savedAtLabel}. Utkastet är knutet till ditt konto på den här enheten och rensas när du loggar ut eller efter 12 timmar.`
                    : "Skriv tryggt vidare. Utkastet sparas tillfälligt på den här enheten, knutet till ditt konto, och rensas när du loggar ut eller efter 12 timmar."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearDraft}
                disabled={!hasSavedDraft}
                className="rounded-full"
              >
                Rensa utkast
              </Button>
            </div>
          </div>

          <textarea
            className="min-h-[24rem] flex-1 resize-none bg-[var(--ss-neutral-50)] px-4 py-5 text-sm leading-7 text-[var(--ss-neutral-900)] placeholder:text-[var(--ss-neutral-300)] focus:outline-none"
            placeholder={selectedTemplateInfo.placeholder}
            value={rawInput}
            onChange={(event) => updateRawInput(event.target.value)}
          />

          {unmatchedWarnings.length > 0 ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
              ⚠ Dessa ord kan vara namn som inte kändes igen automatiskt:{" "}
              <strong>{unmatchedWarnings.join(", ")}</strong>. Lägg till dem i namnlistan ovan om
              det stämmer.
            </div>
          ) : null}

          {quotaExceeded ? (
            <div className="border-t border-[var(--ss-accent)] bg-[var(--ss-accent-soft)] px-4 py-3 text-sm leading-7 text-[var(--ss-neutral-900)]">
              {quotaExceededMessage}{" "}
              <Link
                href="/konto"
                className="font-medium text-[var(--ss-primary)] underline hover:no-underline"
              >
                Gå till konto
              </Link>{" "}
            </div>
          ) : null}

          <div className="border-t border-[var(--ss-neutral-100)] bg-white p-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !rawInput.trim() || quotaExceeded}
              className="w-full rounded-2xl bg-[var(--ss-primary)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "Genererar..."
                : quotaExceeded
                  ? "Månadsgräns nådd"
                  : "Generera dokument →"}
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
