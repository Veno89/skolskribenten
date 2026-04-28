import { useMemo, useState } from "react";
import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";
import {
  createPlanningSyncQueueItem,
  enqueuePlanningSyncItem,
  getPlanningSyncQueueKey,
  parsePlanningSyncQueue,
  serializePlanningSyncQueue,
  type PlanningSyncQueueItem,
} from "@/lib/planning/sync-queue";
import {
  isPlanningScopeMatch,
  type PlanningScope,
} from "@/hooks/planning/types";

interface Params {
  cloudRevision: number | null;
  currentScope: PlanningScope;
  userId: string;
}

interface QueuePayload {
  areaId: string;
  baseRevision?: number | null;
  progressMap: ChecklistProgressMap;
  resolvedConflictId?: string | null;
  resolutionStrategy?: "server" | "merged" | "local" | null;
  revision?: number | null;
  subjectId: string;
  teacherNotes: string;
  updatedAt: string;
}

export function usePlanningSyncQueue({
  cloudRevision,
  currentScope,
  userId,
}: Params) {
  const [queuedSyncCount, setQueuedSyncCount] = useState(0);
  const [queuedItems, setQueuedItems] = useState<PlanningSyncQueueItem[]>([]);
  const syncQueueKey = getPlanningSyncQueueKey(userId);
  const currentQueuedItem = useMemo(
    () => queuedItems.find((item) => isPlanningScopeMatch(item, currentScope)),
    [currentScope, queuedItems],
  );
  const currentQueuedConflict =
    currentQueuedItem?.status === "conflict" && currentQueuedItem.conflictState ? currentQueuedItem : undefined;
  const hasPendingQueuedItem = queuedItems.some((item) => item.status === "pending");

  const refreshQueueState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const queue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    setQueuedSyncCount(queue.length);
    setQueuedItems(queue);
  };

  const persistQueueState = (queue: PlanningSyncQueueItem[]) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(syncQueueKey, serializePlanningSyncQueue(queue));
    setQueuedSyncCount(queue.length);
    setQueuedItems(queue);
  };

  const enqueueSyncPayload = (payload: QueuePayload) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const nextQueue = enqueuePlanningSyncItem(
      currentQueue,
      createPlanningSyncQueueItem({
        ...payload,
        baseRevision: payload.baseRevision ?? payload.revision ?? cloudRevision,
        enqueuedAt: new Date().toISOString(),
      }),
    );

    persistQueueState(nextQueue);
  };

  return {
    currentQueuedConflict,
    currentQueuedItem,
    enqueueSyncPayload,
    hasPendingQueuedItem,
    persistQueueState,
    queuedItems,
    queuedSyncCount,
    refreshQueueState,
    syncQueueKey,
  };
}
