import { describe, expect, it } from "vitest";
import { SUBJECT_CURRICULUM } from "@/lib/planning/curriculum";
import {
  analyzeChecklistGap,
  buildPlanningPrompt,
  getDefaultStatusMap,
} from "@/lib/planning/gap-analysis";

const area = SUBJECT_CURRICULUM[0].areas[0];

describe("planning gap analysis", () => {
  it("builds default map with all items as not started", () => {
    const defaults = getDefaultStatusMap(area);

    expect(Object.keys(defaults)).toHaveLength(area.items.length);
    expect(Object.values(defaults).every((status) => status === "not_started")).toBe(true);
  });

  it("computes completion and missing items", () => {
    const result = analyzeChecklistGap(area, {
      [area.items[0].id]: "done",
      [area.items[1].id]: "in_progress",
      [area.items[2].id]: "not_started",
      [area.items[3].id]: "not_started",
      [area.items[4].id]: "done",
    });

    expect(result.doneCount).toBe(2);
    expect(result.inProgressCount).toBe(1);
    expect(result.notStartedCount).toBe(2);
    expect(result.completionRate).toBe(40);
    expect(result.missingItems).toHaveLength(2);
  });

  it("creates AI underlag prompt including statuses and notes", () => {
    const prompt = buildPlanningPrompt({
      area,
      progressMap: {
        [area.items[0].id]: "done",
      },
      teacherNotes: "Eleverna behöver mer stöd i källkritik.",
    });

    expect(prompt).toContain("Jag undervisar inom området");
    expect(prompt).toContain("Eleverna behöver mer stöd i källkritik.");
    expect(prompt).toContain(": done");
  });
});
