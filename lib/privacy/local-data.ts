import { DRAFT_STORAGE_PREFIX, LEGACY_DRAFT_STORAGE_KEY } from "@/lib/drafting/draft-storage";
import { PLANNING_STORAGE_PREFIX } from "@/lib/planning/checklist-storage";
import { PLANNING_ONBOARDING_STORAGE_PREFIX } from "@/lib/planning/onboarding-storage";
import { SYNC_QUEUE_PREFIX } from "@/lib/planning/sync-queue";

interface MinimalStorage {
  key: (index: number) => string | null;
  length: number;
  removeItem: (key: string) => void;
}

const LOCAL_DATA_PREFIXES = [
  DRAFT_STORAGE_PREFIX,
  PLANNING_STORAGE_PREFIX,
  PLANNING_ONBOARDING_STORAGE_PREFIX,
  SYNC_QUEUE_PREFIX,
] as const;

function isSkolskribentenLocalDataKey(key: string): boolean {
  return key === LEGACY_DRAFT_STORAGE_KEY || LOCAL_DATA_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function clearAllLocalAppStorage(storage: MinimalStorage): number {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key && isSkolskribentenLocalDataKey(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
  return keysToRemove.length;
}
