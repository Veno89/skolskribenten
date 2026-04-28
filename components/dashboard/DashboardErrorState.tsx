"use client";

import { Button } from "@/components/ui/button";

interface Props {
  actionLabel: string;
  digest?: string;
  eyebrow?: string;
  message: string;
  onAction: () => void;
  title: string;
}

export function DashboardErrorState({
  actionLabel,
  digest,
  eyebrow = "Dashboard",
  message,
  onAction,
  title,
}: Props): JSX.Element {
  return (
    <main id="main-content" className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{message}</p>
        {digest ? (
          <p className="mt-3 break-all text-xs leading-6 text-muted-foreground">
            Felkod: {digest}
          </p>
        ) : null}
        <Button type="button" onClick={onAction} className="mt-6 rounded-full">
          {actionLabel}
        </Button>
      </section>
    </main>
  );
}
