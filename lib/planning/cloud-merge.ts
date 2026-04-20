import type { ChecklistProgressMap, ChecklistStatus } from "@/lib/planning/gap-analysis";

const STATUS_PRIORITY: Record<ChecklistStatus, number> = {
  done: 3,
  in_progress: 2,
  not_started: 1,
};

function pickHigherPriorityStatus(a: ChecklistStatus, b: ChecklistStatus): ChecklistStatus {
  return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;
}

export function mergeProgressMaps(
  serverMap: ChecklistProgressMap,
  clientMap: ChecklistProgressMap,
): ChecklistProgressMap {
  const keys = new Set([...Object.keys(serverMap), ...Object.keys(clientMap)]);
  const merged: ChecklistProgressMap = {};

  for (const key of keys) {
    const serverStatus = serverMap[key] ?? "not_started";
    const clientStatus = clientMap[key] ?? "not_started";
    merged[key] = pickHigherPriorityStatus(serverStatus, clientStatus);
  }

  return merged;
}

export function mergeTeacherNotes(serverNotes: string, clientNotes: string): string {
  const normalizedServer = serverNotes.trim();
  const normalizedClient = clientNotes.trim();

  if (!normalizedServer) {
    return normalizedClient;
  }

  if (!normalizedClient || normalizedServer === normalizedClient) {
    return normalizedServer;
  }

  return `${normalizedServer}\n\n---\n\n${normalizedClient}`;
}
