import Link from "next/link";

interface Section {
  title: string;
  paragraphs: string[];
}

interface Props {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: Section[];
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  lastUpdated,
  sections,
}: Props): JSX.Element {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-14 lg:px-8">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Till startsidan
          </Link>
          <span aria-hidden="true">•</span>
          <Link
            href="/registrera"
            className="transition-colors hover:text-[var(--ss-neutral-900)]"
          >
            Prova gratis
          </Link>
          <span aria-hidden="true">•</span>
          <Link
            href="/kontakt"
            className="transition-colors hover:text-[var(--ss-neutral-900)]"
          >
            Kontakt
          </Link>
        </div>

        <section className="ss-card p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--ss-primary)]">{eyebrow}</p>
          <h1
            className="mt-4 text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)] md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{intro}</p>
          <p className="mt-6 text-sm text-muted-foreground">Senast uppdaterad: {lastUpdated}</p>
        </section>

        <div className="grid gap-5">
          {sections.map((section) => (
            <section key={section.title} className="ss-card p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-8 text-[var(--ss-neutral-800)]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
