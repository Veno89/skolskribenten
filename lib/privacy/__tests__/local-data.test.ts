import { describe, expect, it } from "vitest";
import { LEGACY_DRAFT_STORAGE_KEY, DRAFT_STORAGE_PREFIX } from "@/lib/drafting/draft-storage";
import { PLANNING_STORAGE_PREFIX } from "@/lib/planning/checklist-storage";
import { PLANNING_ONBOARDING_STORAGE_PREFIX } from "@/lib/planning/onboarding-storage";
import { SYNC_QUEUE_PREFIX } from "@/lib/planning/sync-queue";
import { clearAllLocalAppStorage } from "@/lib/privacy/local-data";

function createStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));

  return {
    storage: {
      get length() {
        return store.size;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
    },
    store,
  };
}

describe("clearAllLocalAppStorage", () => {
  it("removes drafting, planning, sync queue, and onboarding storage while keeping unrelated keys", () => {
    const { storage, store } = createStorage({
      [LEGACY_DRAFT_STORAGE_KEY]: "legacy",
      [`${DRAFT_STORAGE_PREFIX}user-1`]: "draft",
      [`${PLANNING_STORAGE_PREFIX}user-1:historia:area`]: "planning",
      [`${SYNC_QUEUE_PREFIX}user-1`]: "queue",
      [`${PLANNING_ONBOARDING_STORAGE_PREFIX}user-1`]: "onboarding",
      "other-app-key": "keep",
    });

    expect(clearAllLocalAppStorage(storage)).toBe(5);
    expect(Array.from(store.keys())).toEqual(["other-app-key"]);
  });
});
