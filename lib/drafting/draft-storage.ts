export const LEGACY_DRAFT_STORAGE_KEY = "skolskribenten-drafts-v1";
export const DRAFT_STORAGE_PREFIX = "skolskribenten-drafts:v2:";
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

interface MinimalStorage {
  key: (index: number) => string | null;
  length: number;
  removeItem: (key: string) => void;
}

export function getDraftStorageKey(userId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${userId}`;
}

export function isDraftTimestampExpired(savedAt: string | null, now: number = Date.now()): boolean {
  if (!savedAt) {
    return false;
  }

  const timestamp = new Date(savedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return true;
  }

  return now - timestamp > DRAFT_TTL_MS;
}

export function clearAllDraftStorage(storage: MinimalStorage): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (
      key &&
      (key === LEGACY_DRAFT_STORAGE_KEY || key.startsWith(DRAFT_STORAGE_PREFIX))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}
