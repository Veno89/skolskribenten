import Link from "next/link";

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: Props): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="ss-card ss-grid overflow-hidden p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--ss-primary)]">Skolskribenten</p>
          <h1
            className="mt-6 text-4xl font-semibold leading-tight text-[var(--ss-neutral-900)] md:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Pedagogisk dokumentation med lugnare arbetsflöde.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">
            Logga in för att skriva tryggare, snabbare och med GDPR-skärmen aktiv innan något
            lämnar din enhet.
          </p>

          <div className="mt-10 grid gap-4">
            {[
              "Råa anteckningar scrubbas i webbläsaren före varje AI-förfrågan.",
              "Vi lagrar aldrig lärarens inmatade text eller det färdiga dokumentet.",
              "Ditt konto styr bara åtkomst, användning och abonnemang.",
            ].map((item) => (
              <div key={item} className="ss-surface rounded-[1.5rem] border border-white/80 px-5 py-4">
                <p className="text-sm leading-7 text-[var(--ss-neutral-800)]">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-[var(--ss-neutral-900)]">
              Till startsidan
            </Link>
            <span aria-hidden="true">•</span>
            <Link href="/konto" className="transition-colors hover:text-[var(--ss-neutral-900)]">
              Konto
            </Link>
          </div>
        </section>

        <section className="ss-card p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
            {title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-8 border-t border-[var(--ss-neutral-100)] pt-6 text-sm text-muted-foreground">
            {footer}
          </div>
        </section>
      </div>
    </main>
  );
}
