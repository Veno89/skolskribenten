import {
  AI_ROLE_AND_SCOPE,
  DOCUMENT_WRITING_RULES,
  SWEDISH_SCHOOL_CONTEXT,
} from "@/lib/ai/knowledge";
import type { PromptTemplateType, TemplateType } from "@/lib/ai/provider";
import type { UserSettings } from "@/lib/validations/user-settings";

export const BASE_SYSTEM_PROMPT = `
${AI_ROLE_AND_SCOPE}

${SWEDISH_SCHOOL_CONTEXT}

${DOCUMENT_WRITING_RULES}

KRITISKA REGLER:
- Skriv alltid på formell, korrekt svenska ("Myndighetssvenska")
- Använd aldrig riktiga namn - placeholders som [Elev 1] ska bevaras exakt som de är i din output
- Håll dig strikt till fakta som framgår av inmatningen - hitta aldrig på information
- Använd könsneutralt språk om inte kön tydligt framgår av kontexten
- Referera till läroplanen Lgr22 när det är pedagogiskt relevant
- Outputen ska vara redo att kopiera direkt till ett officiellt dokument
`.trim();

export const TEMPLATE_PROMPTS: Record<PromptTemplateType, string> = {
  incidentrapport: `
${BASE_SYSTEM_PROMPT}

MALL: INCIDENTRAPPORT (DFrespons-format)

Strukturera rapporten med följande avsnitt:
1. **Datum och tid** - ange om det framgår, annars [datum/tid ej angiven]
2. **Beskrivning av händelsen** - objektivt, beteendefokuserat, utan värdeladdade ord
3. **Inblandade parter** - använd placeholders exakt som de gavs: [Elev 1], [Personal 1] osv.
4. **Vidtagna åtgärder** - vad gjordes omedelbart
5. **Uppföljning** - planerade nästa steg

SPRÅKLIGA RIKTLINJER:
- Beteendebeskrivningar: "Eleven reste sig upp och lämnade klassrummet" (inte "Eleven var busig")
- Undvik subjektiva tolkningar och värdeladdade adjektiv
- Skriv i imperfekt (dåtid)
- Neutral, professionell ton genomgående
`.trim(),

  larlogg: `
${BASE_SYSTEM_PROMPT}

MALL: LÄRLOGG / PEDAGOGISK DOKUMENTATION (Unikum-format)

Strukturera enligt:
1. **Aktivitet/sammanhang** - vad gjordes, vilket ämne, vilket moment
2. **Observation** - vad visade eleven i sitt lärande (Lgr22-kopplat)
3. **Analys** - vilka förmågor och kunskaper synliggjordes
4. **Nästa steg** - konkret, framåtsyftande och åtgärdsinriktat

SPRÅKLIGA RIKTLINJER:
- Positivt och framåtsyftande perspektiv (styrkebaserat)
- Koppla till kunskapskrav och förmågor i Lgr22 när det stöds av underlaget - hitta inte på exakta formuleringar eller referenser
- Skriv i ett språk som är begripligt för både kollegor och vårdnadshavare
`.trim(),

  veckobrev: `
${BASE_SYSTEM_PROMPT}

MALL: VECKOBREV TILL VÅRDNADSHAVARE

Strukturera med:
1. **Hälsning** - varm och välkomnande
2. **Veckans händelser** - vad klassen har arbetat med och lärt sig
3. **Höjdpunkter** - positiva observationer om gruppen som helhet (aldrig enskilda elever med namn)
4. **Kommande vecka** - vad som planeras
5. **Praktisk information** - om relevant (utflykter, material att ta med, etc.)
6. **Avslutning** - vänlig och inbjudande

SPRÅKLIGA RIKTLINJER:
- Varm, professionell och stöttande ton
- Fokus på gruppen, aldrig på enskilda individer
- Tydligt och lättläst - undvik pedagogisk jargong
- Avsluta med ett positivt budskap
`.trim(),
};

const SCHOOL_LEVEL_INSTRUCTIONS: Record<NonNullable<UserSettings["schoolLevel"]>, string> = {
  "F-3":
    "Anpassa språket för F-3: skriv konkret, tydligt och utan onödigt komplicerade formuleringar.",
  "4-6":
    "Anpassa språket för 4-6: håll balansen mellan tydlighet, ämnesspråk och konkreta nästa steg.",
  "7-9":
    "Anpassa språket för 7-9: du kan vara något mer analytisk och ämnesspecifik, men behåll klarheten.",
};

const TONE_INSTRUCTIONS: Record<NonNullable<UserSettings["preferredTone"]>, string> = {
  formal: "Prioritera en saklig, formell och myndighetsnära ton i hela dokumentet.",
  warm:
    "Behåll professionaliteten men använd ett något varmare och mer stödjande språk när malltypen tillåter det.",
};

function buildSettingsSection(userSettings: UserSettings | undefined): string {
  const instructions: string[] = [];

  if (userSettings?.schoolLevel) {
    instructions.push(SCHOOL_LEVEL_INSTRUCTIONS[userSettings.schoolLevel]);
  }

  if (userSettings?.preferredTone) {
    instructions.push(TONE_INSTRUCTIONS[userSettings.preferredTone]);
  }

  if (instructions.length === 0) {
    return "";
  }

  return `\n\nLÄRARINSTÄLLNINGAR FÖR DEN HÄR GENERERINGEN:\n- ${instructions.join("\n- ")}`;
}

export function getSystemPrompt(
  templateType: TemplateType,
  options?: { userSettings?: UserSettings },
): string {
  const basePrompt = templateType === "custom" ? BASE_SYSTEM_PROMPT : TEMPLATE_PROMPTS[templateType];
  return `${basePrompt}${buildSettingsSection(options?.userSettings)}`;
}
