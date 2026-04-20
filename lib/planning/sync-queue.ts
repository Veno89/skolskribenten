import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";

export interface PlanningSyncQueueItem {
  areaId: string;
  enqueuedAt: string;
  progressMap: ChecklistProgressMap;
  subjectId: string;
  teacherNotes: string;
  updatedAt: string;
}

const SYNC_QUEUE_PREFIX = "skolskribenten:planning-sync-queue:";

export function getPlanningSyncQueueKey(userId: string): string {
  return `${SYNC_QUEUE_PREFIX}${userId}`;
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

      const candidate = item as Partial<PlanningSyncQueueItem>;

      if (
        typeof candidate.areaId !== "string" ||
        typeof candidate.subjectId !== "string" ||
        typeof candidate.teacherNotes !== "string" ||
        typeof candidate.updatedAt !== "string" ||
        !candidate.progressMap ||
        typeof candidate.progressMap !== "object"
      ) {
        return [];
      }

      return [
        {
          areaId: candidate.areaId,
          enqueuedAt:
            typeof candidate.enqueuedAt === "string" ? candidate.enqueuedAt : new Date().toISOString(),
          progressMap: candidate.progressMap as ChecklistProgressMap,
          subjectId: candidate.subjectId,
          teacherNotes: candidate.teacherNotes,
          updatedAt: candidate.updatedAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function serializePlanningSyncQueue(items: PlanningSyncQueueItem[]): string {
  return JSON.stringify(items);
}

export function enqueuePlanningSyncItem(
  existing: PlanningSyncQueueItem[],
  nextItem: PlanningSyncQueueItem,
): PlanningSyncQueueItem[] {
  const deduped = existing.filter(
    (item) => !(item.subjectId === nextItem.subjectId && item.areaId === nextItem.areaId),
  );

  return [...deduped, nextItem];
}
