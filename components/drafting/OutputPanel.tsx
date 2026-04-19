"use client";

import { useState } from "react";
import { DocumentRenderer } from "@/components/drafting/DocumentRenderer";
import { Button } from "@/components/ui/button";
import { TEMPLATE_DETAILS } from "@/lib/drafting/template-content";
import type { TemplateType } from "@/types";

interface Props {
  completion: string;
  isLoading: boolean;
  error?: string;
  templateType: TemplateType;
}

export function OutputPanel({
  completion,
  isLoading,
  error,
  templateType,
}: Props): JSX.Element {
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "failed">("idle");
  const templateInfo = TEMPLATE_DETAILS[templateType];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(completion);
      setCopyStatus("done");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[var(--ss-neutral-100)] px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Färdigt dokument</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ss-neutral-900)]">
            {templateInfo.label}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          disabled={!completion}
          className="rounded-full"
        >
          {copyStatus === "done"
            ? "Kopierat"
            : copyStatus === "failed"
              ? "Kunde inte kopiera"
              : "Kopiera"}
        </Button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-5">
        {error ? (
          <div className="rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800">
            Något gick fel: {error}
          </div>
        ) : null}

        {!completion && !isLoading && !error ? (
          <div className="ss-grid flex h-full min-h-[28rem] flex-col justify-between rounded-[1.75rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-6">
            <div>
              <p className="text-sm font-medium text-[var(--ss-neutral-900)]">
                Din färdiga text visas här efter att du klickat på Generera.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                Skolskribenten skickar bara den scrubade texten vidare till AI-rutten. Namn,
                personnummer och andra identifierare ska redan vara utbytta när dokumentet skapas.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white p-4 text-sm leading-7 text-muted-foreground shadow-sm">
              {templateInfo.emptyStateHint}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3 rounded-[1.75rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--ss-neutral-100)]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-[var(--ss-neutral-100)]" />
            <div className="h-4 w-[92%] animate-pulse rounded-full bg-[var(--ss-neutral-100)]" />
            <div className="h-4 w-[84%] animate-pulse rounded-full bg-[var(--ss-neutral-100)]" />
          </div>
        ) : null}

        {completion ? <DocumentRenderer content={completion} templateType={templateType} /> : null}
      </div>
    </div>
  );
}
