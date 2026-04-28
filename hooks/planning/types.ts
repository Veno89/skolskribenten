import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";

export interface PlanningScope {
  areaId: string;
  subjectId: string;
}

export interface PlanningStoredState {
  progressMap: ChecklistProgressMap;
  revision?: number | null;
  serverUpdatedAt?: string;
  teacherNotes: string;
  updatedAt: string;
}

export function isPlanningScopeMatch(target: PlanningScope, current: PlanningScope): boolean {
  return target.areaId === current.areaId && target.subjectId === current.subjectId;
}
