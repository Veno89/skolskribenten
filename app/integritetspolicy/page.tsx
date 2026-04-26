import type { Metadata } from "next";
import { LegalPage } from "@/components/shared/LegalPage";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description:
    "Så hanterar Skolskribenten kontodata, användningsmetadata och AI-flöden för svenska lärare.",
};

const sections = [
  {
    title: "Vad Skolskribenten är byggd för",
    paragraphs: [
      "Skolskribenten hjälper lärare att omvandla råa anteckningar till färdiga dokumentutkast, till exempel incidentrapporter, lärloggar och veckobrev.",
      "Tjänsten är byggd med dataminimering som grundprincip. Målet är att lärares anteckningar ska scrubbas i webbläsaren innan något skickas vidare till AI-tjänsten.",
    ],
  },
  {
    title: "Vilka uppgifter vi sparar",
    paragraphs: [
      "Vi sparar kontouppgifter som e-postadress, namn, eventuell skola eller arbetsplats, abonnemangsstatus, betalningsrelaterade identifierare och valda inställningar för skrivton och skolnivå.",
      "Vi sparar också användningsmetadata som malltyp, tidpunkt för generering, om scrubbern kördes och hur många uppgifter som skyddades. Detta används för kontohantering, gratiskvot, abonnemang och produktdrift.",
      "Om du använder planeringsytans cloudsync sparas checklistestatus och egna planeringsanteckningar så att de kan återställas mellan enheter. Om du skickar ett supportärende sparas meddelandet du själv skriver i supportinkorgen.",
    ],
  },
  {
    title: "Vad vi inte är tänkta att spara",
    paragraphs: [
      "Skrivstationen är utformad för att inte lagra lärarens råa dokumentationsanteckningar i databasen.",
      "Skolskribenten är också utformad för att inte lagra det färdiga AI-genererade dokumentet i databasen. Texten visas i stället direkt i webbläsaren så att läraren själv kan granska och använda den.",
      "Planeringsanteckningar i cloudsync och supportmeddelanden är separata undantag. Skriv därför inte elevnamn, personnummer eller känsliga elevuppgifter i supportformuläret.",
    ],
  },
  {
    title: "AI-behandling och tredje part",
    paragraphs: [
      "När genereringsfunktionen används skickas den scrubade texten vidare till den AI-leverantör som är konfigurerad för tjänsten. I den nuvarande produkten är Anthropic Claude den primära leverantören.",
      "Det är lärarens ansvar att granska resultatet innan texten används i officiell dokumentation eller kommunikation. Skolskribentens scrubber är avsedd att minska risk, men den är best-effort och inte en absolut garanti.",
    ],
  },
  {
    title: "Autentisering, betalningar och teknisk drift",
    paragraphs: [
      "Inloggning och kontohantering sker via Supabase. Betalningar och abonnemangsflöden hanteras via Stripe när sådana funktioner används.",
      "Tekniska loggar och felspårning ska inte innehålla lärares råa anteckningar eller färdig elevnära text. Plattformen är byggd för att logga driftinformation och kontometadata, inte pedagogiskt innehåll.",
    ],
  },
  {
    title: "Dina val och kontakt",
    paragraphs: [
      "Utkast i skrivstationen sparas tillfälligt lokalt i webbläsaren. Planeringsytan kan också spara lokal data och, för Pro-användare, cloudsync-data. Använd inte delade enheter utan att rensa lokal data när du är klar.",
      "Om du vill fråga om hur uppgifter hanteras, upptäcka ett problem eller begära rättelse eller radering av kontoanknuten information kan du kontakta oss via kontakt@skolskribenten.com.",
      "Denna policy kan uppdateras när tjänsten utvecklas vidare. När större förändringar görs uppdateras datumet högst upp på sidan.",
    ],
  },
] as const;

export default function IntegritetspolicyPage(): JSX.Element {
  return (
    <LegalPage
      eyebrow="Integritet"
      title="Integritetspolicy"
      intro="Den här sidan beskriver på klarspråk vilka uppgifter Skolskribenten behandlar, vad tjänsten är byggd för att undvika att spara och vilket ansvar som fortfarande ligger hos användaren."
      lastUpdated="26 april 2026"
      sections={sections.map((section) => ({
        title: section.title,
        paragraphs: [...section.paragraphs],
      }))}
    />
  );
}
