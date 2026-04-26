import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";

export type PlanningSyncQueueStatus = "pending" | "failed" | "conflict";

export interface PlanningSyncStateSnapshot {
  progressMap: ChecklistProgressMap;
  teacherNotes: string;
  updatedAt: string;
}

export interface PlanningSyncConflictState {
  localState: PlanningSyncStateSnapshot;
  mergedState?: PlanningSyncStateSnapshot;
  serverState: PlanningSyncStateSnapshot;
}

export interface PlanningSyncQueueItem extends PlanningSyncStateSnapshot {
  areaId: string;
  conflictState: PlanningSyncConflictState | null;
  enqueuedAt: string;
  lastAttemptAt: string;
  lastError: string;
  retryCount: number;
  status: PlanningSyncQueueStatus;
  subjectId: string;
}

export const SYNC_QUEUE_PREFIX = "skolskribenten:planning-sync-queue:";

function isQueueStatus(value: unknown): value is PlanningSyncQueueStatus {
  return value === "pending" || value === "failed" || value === "conflict";
}

function parseConflictState(value: unknown): PlanningSyncConflictState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PlanningSyncConflictState>;

  if (!candidate.localState || !candidate.serverState) {
    return null;
  }

  const normalizeSnapshot = (snapshot: unknown): PlanningSyncStateSnapshot | null => {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const candidateSnapshot = snapshot as Partial<PlanningSyncStateSnapshot>;

    if (
      typeof candidateSnapshot.teacherNotes !== "string" ||
      typeof candidateSnapshot.updatedAt !== "string" ||
      !candidateSnapshot.progressMap ||
      typeof candidateSnapshot.progressMap !== "object"
    ) {
      return null;
    }

    return {
      progressMap: candidateSnapshot.progressMap as ChecklistProgressMap,
      teacherNotes: candidateSnapshot.teacherNotes,
      updatedAt: candidateSnapshot.updatedAt,
    };
  };

  const localState = normalizeSnapshot(candidate.localState);
  const serverState = normalizeSnapshot(candidate.serverState);
  const mergedState = candidate.mergedState ? normalizeSnapshot(candidate.mergedState) : null;

  if (!localState || !serverState) {
    return null;
  }

  return {
    localState,
    mergedState: mergedState ?? undefined,
    serverState,
  };
}

function normalizePlanningSyncItem(item: Partial<PlanningSyncQueueItem>): PlanningSyncQueueItem | null {
  if (
    typeof item.areaId !== "string" ||
    typeof item.subjectId !== "string" ||
    typeof item.teacherNotes !== "string" ||
    typeof item.updatedAt !== "string" ||
    !item.progressMap ||
    typeof item.progressMap !== "object"
  ) {
    return null;
  }

  return {
    areaId: item.areaId,
    conflictState: parseConflictState(item.conflictState),
    enqueuedAt: typeof item.enqueuedAt === "string" ? item.enqueuedAt : new Date().toISOString(),
    lastAttemptAt: typeof item.lastAttemptAt === "string" ? item.lastAttemptAt : "",
    lastError: typeof item.lastError === "string" ? item.lastError : "",
    progressMap: item.progressMap as ChecklistProgressMap,
    retryCount: typeof item.retryCount === "number" && Number.isFinite(item.retryCount) ? item.retryCount : 0,
    status: isQueueStatus(item.status) ? item.status : "pending",
    subjectId: item.subjectId,
    teacherNotes: item.teacherNotes,
    updatedAt: item.updatedAt,
  };
}

export function getPlanningSyncQueueKey(userId: string): string {
  return `${SYNC_QUEUE_PREFIX}${userId}`;
}

export function getPlanningSyncItemKey(item: Pick<PlanningSyncQueueItem, "subjectId" | "areaId">): string {
  return `${item.subjectId}:${item.areaId}`;
}

export function parsePlanningSyncQueue(rawValue: string | null): PlanningSyncQueueItem[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const normalized = normalizePlanningSyncItem(item as Partial<PlanningSyncQueueItem>);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}

export function serializePlanningSyncQueue(items: PlanningSyncQueueItem[]): string {
  return JSON.stringify(items);
}

export function createPlanningSyncQueueItem(
  item: Pick<
    PlanningSyncQueueItem,
    "areaId" | "enqueuedAt" | "progressMap" | "subjectId" | "teacherNotes" | "updatedAt"
  >,
): PlanningSyncQueueItem {
  return {
    ...item,
    conflictState: null,
    lastAttemptAt: "",
    lastError: "",
    retryCount: 0,
    status: "pending",
  };
}

export function enqueuePlanningSyncItem(
  existing: PlanningSyncQueueItem[],
  nextItem: PlanningSyncQueueItem,
): PlanningSyncQueueItem[] {
  const deduped = existing.filter(
    (item) => getPlanningSyncItemKey(item) !== getPlanningSyncItemKey(nextItem),
  );

  return [...deduped, createPlanningSyncQueueItem(nextItem)];
}

export function upsertPlanningSyncItem(
  existing: PlanningSyncQueueItem[],
  nextItem: PlanningSyncQueueItem,
): PlanningSyncQueueItem[] {
  const deduped = existing.filter(
    (item) => getPlanningSyncItemKey(item) !== getPlanningSyncItemKey(nextItem),
  );

  return [...deduped, nextItem];
}

export function removePlanningSyncItem(
  existing: PlanningSyncQueueItem[],
  target: Pick<PlanningSyncQueueItem, "subjectId" | "areaId">,
): PlanningSyncQueueItem[] {
  return existing.filter((item) => getPlanningSyncItemKey(item) !== getPlanningSyncItemKey(target));
}

export function markPlanningSyncItemFailed(
  item: PlanningSyncQueueItem,
  params: {
    attemptedAt: string;
    errorMessage: string;
  },
): PlanningSyncQueueItem {
  return {
    ...item,
    conflictState: null,
    lastAttemptAt: params.attemptedAt,
    lastError: params.errorMessage,
    retryCount: item.retryCount + 1,
    status: "failed",
  };
}

export function markPlanningSyncItemConflict(
  item: PlanningSyncQueueItem,
  params: {
    attemptedAt: string;
    conflictState: PlanningSyncConflictState;
    errorMessage?: string;
  },
): PlanningSyncQueueItem {
  return {
    ...item,
    conflictState: params.conflictState,
    lastAttemptAt: params.attemptedAt,
    lastError: params.errorMessage ?? "Det finns en nyare version i molnet som behöver ditt val.",
    retryCount: item.retryCount + 1,
    status: "conflict",
  };
}

export function markPlanningSyncItemPending(
  item: PlanningSyncQueueItem,
  params?: Partial<
    Pick<PlanningSyncQueueItem, "progressMap" | "teacherNotes" | "updatedAt" | "enqueuedAt">
  >,
): PlanningSyncQueueItem {
  return {
    ...item,
    conflictState: null,
    enqueuedAt: params?.enqueuedAt ?? item.enqueuedAt,
    lastError: "",
    progressMap: params?.progressMap ?? item.progressMap,
    status: "pending",
    teacherNotes: params?.teacherNotes ?? item.teacherNotes,
    updatedAt: params?.updatedAt ?? item.updatedAt,
  };
}
