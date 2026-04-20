import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}

export function ContentPageLayout({ eyebrow, title, intro, children }: Props): JSX.Element {
  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-14 lg:px-8">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Till startsidan
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/om-oss" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Om oss
          </Link>
          <span aria-hidden="true">•</span>
          <Link
            href="/vanliga-fragor"
            className="transition-colors hover:text-[var(--ss-neutral-900)]"
          >
            Vanliga frågor
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/kontakt" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Kontakt
          </Link>
        </div>

        <section className="ss-card p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--ss-primary)]">{eyebrow}</p>
          <h1
            className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)] md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{intro}</p>
        </section>

        {children}
      </div>
    </main>
  );
}
