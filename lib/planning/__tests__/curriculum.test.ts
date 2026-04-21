import { describe, expect, it } from "vitest";
import {
  getSubjectCurriculum,
  getSubjectsForGradeBand,
  PLANNING_GRADE_BANDS,
  SUBJECT_CURRICULUM,
} from "@/lib/planning/curriculum";

describe("planning curriculum", () => {
  it("covers all configured grade bands", () => {
    const coveredBands = new Set(SUBJECT_CURRICULUM.map((subject) => subject.gradeBand));

    expect(coveredBands).toEqual(new Set(PLANNING_GRADE_BANDS));
  });

  it("returns subjects scoped to the requested grade band", () => {
    const middleYearsSubjects = getSubjectsForGradeBand("4-6");

    expect(middleYearsSubjects.map((subject) => subject.id)).toEqual(["matematik", "engelska"]);
  });

  it("exposes the newly added subject curricula", () => {
    expect(getSubjectCurriculum("svenska")?.areas[0]?.items.length).toBeGreaterThan(0);
    expect(getSubjectCurriculum("biologi")?.areas[0]?.items.length).toBeGreaterThan(0);
  });
});
