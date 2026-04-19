"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { TemplatePicker } from "@/components/drafting/TemplatePicker";
import { UsageCounter } from "@/components/drafting/UsageCounter";
import { GdprBadge } from "@/components/gdpr/GdprBadge";
import { Button } from "@/components/ui/button";
import type { Profile, ScrubberStats, TemplateType } from "@/types";

interface Props {
  activePreferences: string[];
  onTemplateChange: (nextTemplate: TemplateType) => void;
  selectedTemplate: TemplateType;
  stats: ScrubberStats | null;
  userProfile: Profile;
}

export function DraftingHeader({
  activePreferences,
  onTemplateChange,
  selectedTemplate,
  stats,
  userProfile,
}: Props): JSX.Element {
  return (
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
        <TemplatePicker value={selectedTemplate} onChange={onTemplateChange} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="rounded-full border-white/70 bg-white/80"
        >
          <Link href="/lektionsplanering">Lektionsplanering</Link>
        </Button>
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
        <GdprBadge stats={stats} />
      </div>
    </header>
  );
}
