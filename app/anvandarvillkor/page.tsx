import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/LegalPage";

export const metadata: Metadata = {
  title: "Användarvillkor",
  description:
    "Villkor för användning av Skolskribenten för svenska lärare och skolnära dokumentation.",
};

const sections = [
  {
    title: "Tjänstens syfte",
    paragraphs: [
      "Skolskribenten är ett arbetsverktyg som hjälper lärare och skolpersonal att formulera tydligare dokumentutkast snabbare.",
      "Tjänsten ska användas som stöd för skrivarbete, inte som ersättning för professionell bedömning, skolans rutiner eller juridisk rådgivning.",
    ],
  },
  {
    title: "Användarens ansvar",
    paragraphs: [
      "Du ansvarar för att alltid granska både inmatning och färdigt resultat innan text används i officiella sammanhang, delas med vårdnadshavare eller förs in i skolans system.",
      "Du ansvarar också för att använda funktionen för extra namn när det behövs. Den inbyggda scrubbern är best-effort och täcker inte automatiskt alla namn som kan förekomma i svenska klassrum.",
      "Du ansvarar för att inte skicka elevnamn, personnummer, hälsouppgifter eller andra känsliga elevuppgifter via supportformuläret eller i planeringsanteckningar om din skola inte har godkänt det arbetssättet.",
    ],
  },
  {
    title: "Tillåten användning",
    paragraphs: [
      "Tjänsten är avsedd för saklig och professionell skolrelaterad dokumentation, till exempel lärloggar, incidentrapporter, veckobrev och andra liknande utkast.",
      "Du får inte använda Skolskribenten för att medvetet kringgå dataskydd, mata in känslig information utan rimlig försiktighet eller använda tjänsten för olagligt eller skadligt innehåll.",
    ],
  },
  {
    title: "AI-genererat innehåll",
    paragraphs: [
      "AI-genererade svar kan innehålla fel, utelämnanden eller formuleringar som behöver justeras. Därför ska innehållet alltid ses som ett utkast som kräver mänsklig kontroll.",
      "Skolskribenten försöker hålla sig till underlaget, men tjänsten lämnar inga garantier för att varje formulering är fullständig, juridiskt korrekt eller lämplig för varje enskild situation.",
    ],
  },
  {
    title: "Konton, abonnemang och tillgänglighet",
    paragraphs: [
      "Vissa funktioner kräver konto. Betalda funktioner och abonnemang hanteras via de betalningsvillkor och flöden som visas i tjänsten vid köptillfället.",
      "Vissa funktioner sparar lokal data i webbläsaren för att kunna återställa ditt arbete. Om du använder en delad enhet behöver du logga ut och rensa lokal data när du är klar.",
      "Vi strävar efter att tjänsten ska fungera stabilt, men kan inte lova oavbruten tillgänglighet. Funktioner kan förändras, pausas eller förbättras under produktens utveckling.",
    ],
  },
  {
    title: "Ändringar och kontakt",
    paragraphs: [
      "Vi kan uppdatera dessa villkor när produkten utvecklas eller när krav på tydlighet och säkerhet förändras. Datumet högst upp på sidan visar när villkoren senast uppdaterades.",
      "Om du har frågor om användning, ansvar eller villkor kan du kontakta oss via kontakt@skolskribenten.com.",
    ],
  },
] as const;

export default function AnvandarvillkorPage(): JSX.Element {
  return (
    <LegalPage
      eyebrow="Villkor"
      title="Användarvillkor"
      intro="De här villkoren beskriver hur Skolskribenten är tänkt att användas och vilket ansvar som ligger kvar hos användaren när AI används som skrivstöd i skolan."
      lastUpdated="26 april 2026"
      sections={sections.map((section) => ({
        title: section.title,
        paragraphs: [...section.paragraphs],
      }))}
    />
  );
}
