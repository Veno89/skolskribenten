import type { PlanningArea } from "@/lib/planning/curriculum";

export type ChecklistStatus = "done" | "in_progress" | "not_started";

export type ChecklistProgressMap = Record<string, ChecklistStatus>;

export interface GapAnalysisResult {
  doneCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completionRate: number;
  missingItems: PlanningArea["items"];
}

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
  area: PlanningArea;
  progressMap: ChecklistProgressMap;
  teacherNotes: string;
}): string {
  const lines = params.area.items.map((item) => {
    const status = params.progressMap[item.id] ?? "not_started";
    return `- ${item.label}: ${status}`;
  });

  return [
    `Jag undervisar inom området "${params.area.title}".`,
    "Nedan är min checklista kopplad till centralt innehåll:",
    ...lines,
    "",
    "Läraranteckningar:",
    params.teacherNotes.trim() || "[inga anteckningar ännu]",
    "",
    "Uppgift:",
    "1) Identifiera vad som verkar saknas eller vara underbehandlat.",
    "2) Ge ett förslag på 2-4 konkreta lektionsmoment för att täcka luckorna.",
    "3) Ge en kort checklista för bedömning/uppföljning.",
    "4) Skriv på professionell svenska med tydlig struktur.",
  ].join("\n");
}
