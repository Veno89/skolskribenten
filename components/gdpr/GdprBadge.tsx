"use client";

import type { ScrubberStats } from "@/types";

interface Props {
  stats: ScrubberStats | null;
}

export function GdprBadge({ stats }: Props): JSX.Element {
  if (!stats) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--ss-neutral-100)] px-3 py-1.5 text-xs text-[var(--ss-neutral-800)]">
        <span className="h-2 w-2 rounded-full bg-[var(--ss-neutral-200)]" />
        GDPR-sköld aktiv
      </div>
    );
  }

  const totalRemoved = stats.namesReplaced + stats.piiTokensReplaced;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      {totalRemoved > 0 ? `${totalRemoved} uppgifter skyddade` : "Inga personuppgifter hittades"}
    </div>
  );
}
