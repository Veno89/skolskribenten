import Link from "next/link";
import { MobileNav } from "@/components/shared/MobileNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TEMPLATE_DETAILS } from "@/lib/drafting/template-content";

const steps = [
  {
    title: "Skriv",
    description: "Klistra in dina anteckningar från lektionen utan att först städa bort namn.",
  },
  {
    title: "GDPR-skölden skyddar",
    description: "Personuppgifter rensas i webbläsaren innan något skickas vidare till AI-tjänsten.",
  },
  {
    title: "Färdigt dokument",
    description: "Få en text som går att kopiera direkt till incidentrapport, Unikum, lärlogg eller veckobrev.",
  },
] as const;

const templates = [
  {
    title: TEMPLATE_DETAILS.incidentrapport.label,
    description: TEMPLATE_DETAILS.incidentrapport.cardDescription,
  },
  {
    title: TEMPLATE_DETAILS.larlogg.label,
    description: TEMPLATE_DETAILS.larlogg.cardDescription,
  },
  {
    title: TEMPLATE_DETAILS.unikum.label,
    description: TEMPLATE_DETAILS.unikum.cardDescription,
  },
  {
    title: TEMPLATE_DETAILS.veckobrev.label,
    description: TEMPLATE_DETAILS.veckobrev.cardDescription,
  },
] as const;

const transparencyPoints = [
  "Dina anteckningar scrubbas i webbläsaren innan de lämnar enheten.",
  "Vi sparar aldrig inmatad text eller AI-genererad text i databasen.",
  "Det enda som loggas är metadata som malltyp, tidpunkt och hur många uppgifter som skyddades.",
] as const;

export default function LandingPage(): JSX.Element {
  return (
    <main className="overflow-hidden bg-[var(--ss-neutral-50)] text-[var(--ss-neutral-900)]">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(74,127,165,0.18),transparent_55%)]" />
      <div className="absolute right-[-8rem] top-28 -z-10 h-72 w-72 rounded-full bg-[rgba(232,168,124,0.18)] blur-3xl" />
      <div className="absolute left-[-6rem] top-[34rem] -z-10 h-80 w-80 rounded-full bg-[rgba(107,171,144,0.14)] blur-3xl" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ss-primary)] text-white shadow-lg shadow-[rgba(74,127,165,0.3)]">
            <span className="text-xl font-semibold">S</span>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-[var(--ss-primary)]">Skolskribenten</p>
            <p className="text-sm text-muted-foreground">Dokumentation för svenska lärare</p>
          </div>
        </div>
        <nav className="flex items-center gap-3">
          <div className="hidden items-center gap-4 lg:flex">
            <Link href="/om-oss" className="text-sm text-muted-foreground transition-colors hover:text-[var(--ss-neutral-900)]">
              Om oss
            </Link>
            <Link
              href="/vanliga-fragor"
              className="text-sm text-muted-foreground transition-colors hover:text-[var(--ss-neutral-900)]"
            >
              Vanliga frågor
            </Link>
            <Link href="/kontakt" className="text-sm text-muted-foreground transition-colors hover:text-[var(--ss-neutral-900)]">
              Kontakt
            </Link>
          </div>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/logga-in">Logga in</Link>
          </Button>
          <Button asChild className="hidden rounded-full px-6 sm:inline-flex">
            <Link href="/registrera">Prova gratis</Link>
          </Button>
          <MobileNav />
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="space-y-8">
          <Badge className="rounded-full bg-[var(--ss-secondary-light)] px-4 py-1.5 text-[var(--ss-neutral-900)] hover:bg-[var(--ss-secondary-light)]">
            GDPR-skyddad dokumentation för grundskolan
          </Badge>
          <div className="space-y-6">
            <h1
              className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Skriv pedagogisk dokumentation på sekunder, inte timmar.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              Skolskribenten hjälper dig förvandla dina anteckningar till färdiga incidentrapporter,
              lärloggar, Unikum-utkast och veckobrev, samtidigt som GDPR-skölden tar bort
              personuppgifter innan texten lämnar din enhet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/registrera">Prova gratis — 10 omvandlingar per månad</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="rounded-full border border-[var(--ss-neutral-200)] bg-white/70 px-7"
            >
              <Link href="/skrivstation">Se skrivstationen</Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              "Vad är det? Klara mallar för incidentrapport, lärlogg, Unikum och veckobrev.",
              "Hur skyddar det eleverna? All scrubbing sker i webbläsaren före nätverkstrafik.",
              "Vad kostar det? Gratisnivå först, därefter två tydliga Pro-val.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/70 bg-white/75 px-4 py-4 text-sm leading-6 text-[var(--ss-neutral-800)] shadow-sm backdrop-blur"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="ss-card ss-grid relative overflow-hidden p-6 md:p-8">
          <div className="absolute right-5 top-5 rounded-full bg-[var(--ss-secondary-light)] px-3 py-1 text-xs font-medium text-[var(--ss-neutral-900)]">
            GDPR-sköld aktiv
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--ss-primary)]">Förhandsvisning</p>
              <h2 className="mt-3 text-2xl font-semibold">Så ser flödet ut i skrivstationen</h2>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Dina anteckningar</p>
              <div className="mt-4 rounded-[1.25rem] border border-dashed border-[var(--ss-primary)]/30 bg-white p-4 text-sm leading-7 text-[var(--ss-neutral-800)]">
                Clara drog Anna i håret under mattelektionen. Jag avbröt direkt, pratade med båda
                eleverna och följde upp händelsen med mentor efter lektionen.
              </div>
              <div className="mt-5 flex items-center gap-2">
                <span className="rounded-full bg-[var(--ss-primary)] px-3 py-1 text-xs font-medium text-white">
                  Incidentrapport
                </span>
                <span className="rounded-full bg-[var(--ss-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--ss-neutral-900)]">
                  2 uppgifter skyddade
                </span>
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-[var(--ss-neutral-900)] p-5 text-white shadow-xl shadow-[rgba(26,25,23,0.24)]">
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">Färdigt dokument</p>
              <p className="mt-4 text-sm leading-7 text-white/90">
                Händelseförlopp: Under matematiklektionen drog [Elev 1] [Elev 2] i håret och
                uttryckte sig grovt kränkande. Omedelbara åtgärder: Situationen avbröts direkt och
                båda eleverna togs åt sidan för en första genomgång.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="ss-card p-8 md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--ss-primary)]">Hur det fungerar</p>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Ett lugnt arbetsflöde när dokumentationen måste bli rätt direkt
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              Skolskribenten är byggt för måndagsmorgnar och sena eftermiddagar: minimalt friktion,
              tydligt språk och ingen risk att glömma bort GDPR-städningen.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[1.5rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ss-primary)] text-sm font-semibold text-white">
                  0{index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 pb-24 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--ss-primary)]">GDPR-transparens</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Du ska förstå exakt vad som skyddas och vad som aldrig lagras.
          </h2>
          <p className="text-base leading-8 text-muted-foreground">
            Förtroende är själva produkten. Därför förklarar Skolskribenten i klartext vad som
            händer med elevuppgifter innan du klickar på Generera.
          </p>
        </div>
        <div className="grid gap-4">
          {transparencyPoints.map((point) => (
            <div key={point} className="ss-card flex items-start gap-4 p-6">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ss-secondary-light)] text-[var(--ss-neutral-900)]">
                ✓
              </div>
              <p className="text-sm leading-7 text-[var(--ss-neutral-800)]">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--ss-primary)]">Mallar</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Fyra dokumenttyper som täcker de vanligaste behoven i vardagen
          </h2>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-4">
          {templates.map((template) => (
            <article key={template.title} className="ss-card p-7">
              <div className="inline-flex rounded-full bg-[var(--ss-primary-light)] px-3 py-1 text-xs font-medium text-[var(--ss-primary-dark)]">
                Klar mall
              </div>
              <h3 className="mt-6 text-2xl font-semibold">{template.title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{template.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="ss-card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[0.76fr_1.24fr]">
            <div className="bg-[var(--ss-neutral-900)] px-8 py-10 text-white">
              <p className="text-sm uppercase tracking-[0.28em] text-white/60">Priser</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Tydliga nivåer utan mörka mönster</h2>
              <p className="mt-4 text-sm leading-7 text-white/78">
                Börja gratis för att bygga en vana. När behovet blir återkommande finns två raka
                Pro-val, båda med samma pris.
              </p>
              <div className="mt-8 rounded-[1.5rem] bg-white/8 p-5">
                <p className="text-sm font-semibold">Gratis — 10 omvandlingar per månad</p>
                <p className="mt-2 text-sm leading-7 text-white/72">
                  Perfekt för att prova arbetsflödet och känna att GDPR-skölden fungerar i din vardag.
                </p>
              </div>
            </div>
            <div className="grid gap-px bg-[var(--ss-neutral-100)] md:grid-cols-2">
              <article className="bg-white px-8 py-10">
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">Pro</p>
                <h3 className="mt-4 text-2xl font-semibold">Pro — Obegränsade omvandlingar, 49 kr/mån</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Ingen bindningstid. Avsluta när som helst.
                </p>
                <Button asChild className="mt-8 rounded-full px-6">
                  <Link href="/konto">Välj månadsabonnemang</Link>
                </Button>
              </article>
              <article className="bg-[var(--ss-neutral-50)] px-8 py-10">
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">30-dagarskort</p>
                <h3 className="mt-4 text-2xl font-semibold">
                  30-dagarskort — Obegränsade omvandlingar i 30 dagar, 49 kr
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">Förnyas inte automatiskt.</p>
                <Button asChild variant="secondary" className="mt-8 rounded-full px-6">
                  <Link href="/konto">Välj 30-dagarskort</Link>
                </Button>
              </article>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/80 bg-white/55">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>Skolskribenten hjälper lärare skriva tryggare, tydligare och snabbare.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/integritetspolicy"
              className="transition-colors hover:text-[var(--ss-neutral-900)]"
            >
              Integritetspolicy
            </Link>
            <Link
              href="/anvandarvillkor"
              className="transition-colors hover:text-[var(--ss-neutral-900)]"
            >
              Användarvillkor
            </Link>
            <Link href="/om-oss" className="transition-colors hover:text-[var(--ss-neutral-900)]">
              Om oss
            </Link>
            <Link
              href="/vanliga-fragor"
              className="transition-colors hover:text-[var(--ss-neutral-900)]"
            >
              Vanliga frågor
            </Link>
            <Link href="/kontakt" className="transition-colors hover:text-[var(--ss-neutral-900)]">
              Kontakt
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
