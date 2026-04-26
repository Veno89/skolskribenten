import type { Json } from "@/types/database";

export const PLANNING_SYNC_CONFLICT_FILTERS = ["unresolved", "resolved", "all"] as const;

export type PlanningSyncConflictFilter = (typeof PLANNING_SYNC_CONFLICT_FILTERS)[number];

export interface PlanningProgressSummary {
  done: number;
  inProgress: number;
  notStarted: number;
  other: number;
  total: number;
}

export function parsePlanningSyncConflictFilter(value: string | undefined): PlanningSyncConflictFilter {
  return PLANNING_SYNC_CONFLICT_FILTERS.includes(value as PlanningSyncConflictFilter)
    ? (value as PlanningSyncConflictFilter)
    : "unresolved";
}

export function getPlanningSyncConflictFilterLabel(filter: PlanningSyncConflictFilter): string {
  if (filter === "unresolved") {
    return "Olösta";
  }

  if (filter === "resolved") {
    return "Lösta";
  }

  return "Alla";
}

export function summarizeProgressMap(value: Json | null | undefined): PlanningProgressSummary {
  const summary: PlanningProgressSummary = {
    done: 0,
    inProgress: 0,
    notStarted: 0,
    other: 0,
    total: 0,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return summary;
  }

  for (const status of Object.values(value)) {
    summary.total += 1;

    if (status === "done") {
      summary.done += 1;
    } else if (status === "in_progress") {
      summary.inProgress += 1;
    } else if (status === "not_started") {
      summary.notStarted += 1;
    } else {
      summary.other += 1;
    }
  }

  return summary;
}

export function formatProgressSummary(summary: PlanningProgressSummary): string {
  if (summary.total === 0) {
    return "0 punkter";
  }

  const parts = [
    `${summary.done} klara`,
    `${summary.inProgress} pågår`,
    `${summary.notStarted} ej startade`,
  ];

  if (summary.other > 0) {
    parts.push(`${summary.other} okända`);
  }

  return `${summary.total} punkter: ${parts.join(", ")}`;
}

export function isPlanningSyncConflictResolved(row: { resolved_at: string | null }): boolean {
  return Boolean(row.resolved_at);
}

export function abbreviateHash(value: string | null | undefined): string {
  return value ? value.slice(0, 12) : "saknas";
}

export function isPlanningClientClockAhead(
  row: { client_updated_at: string | null; updated_at: string | null },
  thresholdMinutes = 5,
): boolean {
  if (!row.client_updated_at || !row.updated_at) {
    return false;
  }

  const clientTime = new Date(row.client_updated_at).getTime();
  const serverTime = new Date(row.updated_at).getTime();

  if (Number.isNaN(clientTime) || Number.isNaN(serverTime)) {
    return false;
  }

  return clientTime - serverTime > thresholdMinutes * 60 * 1000;
}
