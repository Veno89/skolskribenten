export interface PromptRecipe {
  id: string;
  label: string;
  purpose: string;
  template: string;
}

export const PLANNING_ONBOARDING_STEPS = [
  {
    id: "choose_scope",
    title: "Välj ämne och område",
    description: "Börja med rätt ämne och arbetsområde så att checklistan blir träffsäker.",
  },
  {
    id: "mark_coverage",
    title: "Markera täckning",
    description: "Sätt status på varje punkt: Genomfört, Pågår eller Inte påbörjat.",
  },
  {
    id: "write_notes",
    title: "Skriv läraranteckningar",
    description: "Beskriv vad som fungerat, elevbehov och vad du vill prioritera framåt.",
  },
  {
    id: "copy_ai_prompt",
    title: "Kopiera AI-underlag",
    description: "Klistra in i Skrivstationens Eget dokument för konkreta lektionsförslag.",
  },
] as const;

export const PROMPT_SCHOOL_RECIPES: PromptRecipe[] = [
  {
    id: "lektionsplanering",
    label: "Lektionsplanering",
    purpose: "Skapa ett tydligt lektionsupplägg med progression och uppföljning.",
    template: `Du är min planeringscoach i [ämne/årskurs].\n\nHär är nuläget:\n- Mål/område: [ange]\n- Vad eleverna redan gjort: [ange]\n- Vad som saknas: [ange]\n- Elevbehov/anpassningar: [ange]\n\nJag vill ha:\n1) Ett lektionsupplägg i 3-5 steg\n2) Differentiering för olika elevbehov\n3) Exit ticket eller kort uppföljning\n4) Koppling till centralt innehåll (utan att hitta på citat).`,
  },
  {
    id: "vikarie",
    label: "Vikarieanteckning",
    purpose: "Gör ett genomförbart underlag för vikarie med tydliga instruktioner.",
    template: `Hjälp mig skriva en vikarieanteckning för [klass/ämne].\n\nRamar:\n- Tidsblock: [ange]\n- Uppgifter/material: [ange]\n- Viktigt för studiero/trygghet: [ange]\n- Anpassningar: [ange]\n\nSkriv tydligt och praktiskt med rubriker:\n1) Dagens plan\n2) Viktiga rutiner\n3) Anpassningar\n4) Checklista före/under/efter lektion.`,
  },
  {
    id: "kartlaggning",
    label: "Pedagogisk kartläggning",
    purpose: "Ta fram sakliga observationer, hinder och möjliga nästa anpassningar.",
    template: `Jag behöver stöd att formulera underlag till pedagogisk kartläggning.\n\nUnderlag:\n- Observerade styrkor: [ange]\n- Observerade hinder i lärmiljön: [ange]\n- Genomförda anpassningar: [ange]\n- Effekt hittills: [ange]\n\nSkriv sakligt och strukturerat:\n1) Styrkor\n2) Hinder\n3) Genomförda insatser\n4) Nästa steg för fortsatt kartläggning.`,
  },
];

export type OnboardingStepId = (typeof PLANNING_ONBOARDING_STEPS)[number]["id"];
