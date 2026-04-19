import { describe, expect, it } from "vitest";
import {
  DRAFT_STORAGE_PREFIX,
  DRAFT_TTL_MS,
  LEGACY_DRAFT_STORAGE_KEY,
  clearAllDraftStorage,
  getDraftStorageKey,
  isDraftTimestampExpired,
} from "../draft-storage";

function createMemoryStorage(initialKeys: string[]) {
  const keys = [...initialKeys];

  return {
    get length() {
      return keys.length;
    },
    key(index: number) {
      return keys[index] ?? null;
    },
    keys() {
      return [...keys];
    },
    removeItem(key: string) {
      const index = keys.indexOf(key);

      if (index >= 0) {
        keys.splice(index, 1);
      }
    },
  };
}

describe("draft-storage", () => {
  it("scopes draft storage keys by user id", () => {
    expect(getDraftStorageKey("user-123")).toBe(`${DRAFT_STORAGE_PREFIX}user-123`);
  });

  it("expires old or invalid draft timestamps", () => {
    const now = Date.parse("2026-04-19T12:00:00.000Z");

    expect(
      isDraftTimestampExpired(
        new Date(now - DRAFT_TTL_MS - 1).toISOString(),
        now,
      ),
    ).toBe(true);
    expect(isDraftTimestampExpired("not-a-date", now)).toBe(true);
    expect(
      isDraftTimestampExpired(
        new Date(now - DRAFT_TTL_MS + 5_000).toISOString(),
        now,
      ),
    ).toBe(false);
  });

  it("clears both legacy and user-scoped draft keys", () => {
    const storage = createMemoryStorage([
      LEGACY_DRAFT_STORAGE_KEY,
      `${DRAFT_STORAGE_PREFIX}teacher-a`,
      `${DRAFT_STORAGE_PREFIX}teacher-b`,
      "unrelated-key",
    ]);

    clearAllDraftStorage(storage);

    expect(storage.keys()).toEqual(["unrelated-key"]);
  });
});
