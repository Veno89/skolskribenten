import type { PlanningArea, SubjectCurriculum } from "@/lib/planning/curriculum";

export type ChecklistStatus = "done" | "in_progress" | "not_started";

export type ChecklistProgressMap = Record<string, ChecklistStatus>;

export interface GapAnalysisResult {
  doneCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completionRate: number;
  missingItems: PlanningArea["items"];
}

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  done: "Genomfört",
  in_progress: "Pågår",
  not_started: "Inte påbörjat",
};

export function getDefaultStatusMap(area: PlanningArea): ChecklistProgressMap {
  return Object.fromEntries(area.items.map((item) => [item.id, "not_started"])) as ChecklistProgressMap;
}

export function analyzeChecklistGap(
  area: PlanningArea,
  progressMap: ChecklistProgressMap,
): GapAnalysisResult {
  let doneCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  const missingItems = area.items.filter((item) => {
    const status = progressMap[item.id] ?? "not_started";

    if (status === "done") {
      doneCount += 1;
      return false;
    }

    if (status === "in_progress") {
      inProgressCount += 1;
      return false;
    }

    notStartedCount += 1;
    return true;
  });

  const completionRate = area.items.length === 0 ? 0 : Math.round((doneCount / area.items.length) * 100);

  return {
    doneCount,
    inProgressCount,
    notStartedCount,
    completionRate,
    missingItems,
  };
}

export function buildPlanningPrompt(params: {
  subject: SubjectCurriculum;
  area: PlanningArea;
  progressMap: ChecklistProgressMap;
  teacherNotes: string;
}): string {
  const gapAnalysis = analyzeChecklistGap(params.area, params.progressMap);
  const checklistLines = params.area.items.map((item) => {
    const status = params.progressMap[item.id] ?? "not_started";
    return `- ${item.label} (${STATUS_LABELS[status]}): ${item.guidance}`;
  });
  const missingLines =
    gapAnalysis.missingItems.length > 0
      ? gapAnalysis.missingItems.map((item) => `- ${item.label}`)
      : ["- Inga tydliga luckor markerade just nu. Planera för fördjupning, repetition eller bedömning."];

  return [
    `Jag planerar undervisning i ${params.subject.label} för ${params.subject.gradeBand}.`,
    `Område: ${params.area.title}.`,
    params.area.description,
    "",
    "Nuvarande täckning:",
    `- Genomfört: ${gapAnalysis.doneCount}`,
    `- Pågår: ${gapAnalysis.inProgressCount}`,
    `- Inte påbörjat: ${gapAnalysis.notStartedCount}`,
    `- Täckningsgrad: ${gapAnalysis.completionRate}%`,
    "",
    "Checklista kopplad till centralt innehåll:",
    ...checklistLines,
    "",
    "Det som tydligast saknas eller behöver följas upp:",
    ...missingLines,
    "",
    "Läraranteckningar:",
    params.teacherNotes.trim() || "[inga anteckningar ännu]",
    "",
    "Uppgift:",
    "Ta fram ett konkret nästa undervisningssteg i form av en kort, användbar lektionsplanering.",
    "Svara med exakt denna struktur så att texten blir lätt att rendera och kopiera vidare:",
    "## Planeringsöversikt",
    "Område: ...",
    "Årskurs/årsspann: ...",
    "Undervisningsfokus nästa steg: ...",
    "**Vad som behöver täckas nu**",
    "- ...",
    "## Lektionsupplägg",
    "**Lektionsmål**",
    "- ...",
    "**Lektionsgång steg för steg**",
    "- ...",
    "**Anpassningar och stöd**",
    "- ...",
    "**Material och förberedelser**",
    "- ...",
    "**Bedömning och uppföljning**",
    "- ...",
    "> Lägg till en kort notis om vad läraren särskilt bör följa upp i nästa lektion.",
    "",
    "Regler:",
    "- Bygg bara på informationen ovan och skriv [behöver kompletteras] om uppgifter saknas.",
    "- Lyft tydligt progression, elevbehov och nästa undervisningssteg.",
    "- Håll strukturen kort, professionell och fri från markdown-tabeller eller avdelare.",
  ].join("\n");
}
