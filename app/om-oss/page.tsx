import { ContentPageLayout } from "@/components/shared/ContentPageLayout";

const principles = [
  {
    title: "Vi bygger för lärarvardagen",
    text: "Skolskribenten finns för de där minuterna mellan lektion, rastvakt och elevärenden där dokumentationen ändå måste bli gjord. Verktyget ska kännas lugnt, tydligt och snabbt att förstå utan onboarding-friktion.",
  },
  {
    title: "Integritet är inte en eftertanke",
    text: "Det viktigaste produktbeslutet är att anteckningarna scrubbas i webbläsaren innan något skickas vidare. Det betyder att elevnära råtext inte ska behöva lämna lärarens enhet för att man ska få hjälp med formuleringen.",
  },
  {
    title: "AI ska hjälpa, inte ta över",
    text: "Målet är inte att ersätta professionellt omdöme utan att ge lärare ett bättre första utkast. Därför fokuserar Skolskribenten på struktur, saklighet och nästa steg, inte på att hitta på sådant som inte finns i underlaget.",
  },
];

export default function OmOssPage(): JSX.Element {
  return (
    <ContentPageLayout
      eyebrow="Om oss"
      title="Vi bygger Skolskribenten för att skolans dokumentation ska ta mindre kraft"
      intro="Bakom produkten finns en tydlig idé: lärare ska kunna få hjälp med språk, struktur och tempo utan att ge upp kontrollen över känsligt innehåll. Därför kombinerar vi ett smalt skolfokus med integritet som grundkrav."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        {principles.map((principle) => (
          <article key={principle.title} className="ss-card p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
              {principle.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{principle.text}</p>
          </article>
        ))}
      </section>

      <section className="ss-card p-8 md:p-10">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">Varför nu</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <p className="text-sm leading-7 text-[var(--ss-neutral-800)]">
            Dokumentationskraven i skolan försvinner inte. Samtidigt förväntas lärare vara snabba,
            sakliga, juridiskt medvetna och tydliga gentemot kollegor, elevhälsa och
            vårdnadshavare. Den kombinationen gör att varje dåligt formulerad anteckning kostar tid.
          </p>
          <p className="text-sm leading-7 text-[var(--ss-neutral-800)]">
            Skolskribenten försöker lösa just det: få bort startsträckan, minska dubbelarbetet och
            ge ett tryggt första utkast som fortfarande känns professionellt och mänskligt.
          </p>
        </div>
      </section>
    </ContentPageLayout>
  );
}
