import { ContentPageLayout } from "@/components/shared/ContentPageLayout";

const faqItems = [
  {
    question: "Sparas mina anteckningar i databasen?",
    answer:
      "Nej. Skolskribenten är byggt så att råtexten scrubbas i webbläsaren innan något skickas vidare. Det som sparas är kontouppgifter, abonnemangsstatus och användningsmetadata, inte själva anteckningarna eller den färdiga AI-texten.",
  },
  {
    question: "Kan jag skriva riktiga elevnamn i rutan?",
    answer:
      "Ja, det är tänkt så. GDPR-skölden försöker ersätta namn och annan identifierande information innan texten lämnar din enhet. Om du arbetar med namn som inte fångas automatiskt ska du lägga till dem i fältet Extra namn att skydda.",
  },
  {
    question: "Vad är skillnaden mellan Lärlogg och Unikum?",
    answer:
      "Lärlogg är ett mer allmänt pedagogiskt dokumentläge. Unikum-läget är stramare och mer kopieringsvänligt för dokumentation där du vill ha korta fält för sammanhang, lärande och nästa steg.",
  },
  {
    question: "Kan jag förlora det jag skrivit om jag blir avbruten?",
    answer:
      "Nej, inte lika lätt längre. Skrivstationen sparar nu dina utkast lokalt i webbläsaren på den här enheten så att du kan komma tillbaka även om du tappar uppkopplingen eller behöver lämna sidan.",
  },
  {
    question: "Är texten färdig att använda direkt?",
    answer:
      "Den är tänkt att ge dig ett snabbt och professionellt första utkast, men du ska alltid läsa igenom texten innan du använder den i ett skarpt ärende eller delar den vidare.",
  },
  {
    question: "Kommer fler mallar?",
    answer:
      "Ja. Lektionsplanering ligger redan som en kommande flik i dashboarden, och fler skolnära arbetsflöden kommer att prioriteras utifrån tester och feedback från riktiga användare.",
  },
];

export default function VanligaFragorPage(): JSX.Element {
  return (
    <ContentPageLayout
      eyebrow="Vanliga frågor"
      title="Det här undrar lärare oftast innan de börjar testa"
      intro="Här har vi samlat svar på de vanligaste frågorna om integritet, arbetsflöde, mallar och hur Skolskribenten passar in i skolans vardag."
    >
      <section className="space-y-4">
        {faqItems.map((item) => (
          <details
            key={item.question}
            className="ss-card group overflow-hidden rounded-[1.75rem] p-0"
          >
            <summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold text-[var(--ss-neutral-900)] marker:hidden">
              <span className="flex items-center justify-between gap-4">
                <span>{item.question}</span>
                <span className="text-[var(--ss-primary)] transition-transform group-open:rotate-45">
                  +
                </span>
              </span>
            </summary>
            <div className="border-t border-[var(--ss-neutral-100)] px-6 py-5 text-sm leading-7 text-muted-foreground">
              {item.answer}
            </div>
          </details>
        ))}
      </section>
    </ContentPageLayout>
  );
}
