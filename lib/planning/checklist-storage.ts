import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";
import type { PlanningSubjectId } from "@/lib/planning/curriculum";

interface StoredChecklistState {
  progressMap: ChecklistProgressMap;
  teacherNotes: string;
  updatedAt: string;
}

interface StorageEnvelope {
  version: 1;
  state: StoredChecklistState;
}

interface PlanningExportEntry {
  key: string;
  state: StoredChecklistState;
}

export interface PlanningExportPayload {
  version: 1;
  exportedAt: string;
  entries: PlanningExportEntry[];
}

export const PLANNING_STORAGE_PREFIX = "skolskribenten:planning:";
export const MAX_PLANNING_IMPORT_BYTES = 512 * 1024;
export const MAX_PLANNING_EXPORT_ENTRIES = 250;
export const MAX_PLANNING_TEACHER_NOTES_LENGTH = 5000;

export function getPlanningStorageKey(userId: string, subjectId: PlanningSubjectId, areaId: string): string {
  return `${PLANNING_STORAGE_PREFIX}${userId}:${subjectId}:${areaId}`;
}

export function parseStoredChecklist(value: string | null): StoredChecklistState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StorageEnvelope>;

    if (parsed.version !== 1 || !parsed.state || typeof parsed.state !== "object") {
      return null;
    }

    const teacherNotes =
      typeof parsed.state.teacherNotes === "string"
        ? parsed.state.teacherNotes.slice(0, MAX_PLANNING_TEACHER_NOTES_LENGTH)
        : "";
    const updatedAt = typeof parsed.state.updatedAt === "string" ? parsed.state.updatedAt : "";
    const progressMap =
      parsed.state.progressMap && typeof parsed.state.progressMap === "object"
        ? (parsed.state.progressMap as ChecklistProgressMap)
        : {};

    return {
      progressMap,
      teacherNotes,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function serializeChecklistState(state: StoredChecklistState): string {
  return JSON.stringify({
    version: 1,
    state,
  } satisfies StorageEnvelope);
}

function isPlanningStorageKeyForUser(key: string, userId: string): boolean {
  return key.startsWith(`${PLANNING_STORAGE_PREFIX}${userId}:`);
}

export function buildPlanningExportPayload(storage: Storage, userId: string): PlanningExportPayload {
  const entries: PlanningExportEntry[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key || !isPlanningStorageKeyForUser(key, userId)) {
      continue;
    }

    const parsed = parseStoredChecklist(storage.getItem(key));

    if (!parsed) {
      continue;
    }

    entries.push({ key, state: parsed });

    if (entries.length >= MAX_PLANNING_EXPORT_ENTRIES) {
      break;
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function parsePlanningExportPayload(rawValue: string): PlanningExportPayload | null {
  if (rawValue.length > MAX_PLANNING_IMPORT_BYTES) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PlanningExportPayload>;

    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return null;
    }

    if (parsed.entries.length > MAX_PLANNING_EXPORT_ENTRIES) {
      return null;
    }

    const entries = parsed.entries
      .map((entry) => {
        if (!entry || typeof entry.key !== "string") {
          return null;
        }

        const normalized: StoredChecklistState = {
          progressMap:
            entry.state && typeof entry.state.progressMap === "object"
              ? (entry.state.progressMap as ChecklistProgressMap)
              : {},
          teacherNotes:
            entry.state && typeof entry.state.teacherNotes === "string"
              ? entry.state.teacherNotes.slice(0, MAX_PLANNING_TEACHER_NOTES_LENGTH)
              : "",
          updatedAt:
            entry.state && typeof entry.state.updatedAt === "string" ? entry.state.updatedAt : "",
        };

        return { key: entry.key, state: normalized };
      })
      .filter((entry): entry is PlanningExportEntry => Boolean(entry));

    return {
      version: 1,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : "",
      entries,
    };
  } catch {
    return null;
  }
}

export function applyPlanningImportPayload(
  storage: Storage,
  userId: string,
  payload: PlanningExportPayload,
): number {
  let importedCount = 0;

  for (const entry of payload.entries) {
    if (!isPlanningStorageKeyForUser(entry.key, userId)) {
      continue;
    }

    storage.setItem(entry.key, serializeChecklistState(entry.state));
    importedCount += 1;
  }

  return importedCount;
}

export type { StoredChecklistState };
