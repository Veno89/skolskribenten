import { describe, expect, it } from "vitest";
import {
  applyPlanningImportPayload,
  buildPlanningExportPayload,
  getPlanningStorageKey,
  parsePlanningExportPayload,
  parseStoredChecklist,
  serializeChecklistState,
} from "@/lib/planning/checklist-storage";

describe("planning checklist storage", () => {
  it("builds scoped storage key", () => {
    expect(getPlanningStorageKey("user-1", "historia", "industriella-revolutionen")).toBe(
      "skolskribenten:planning:user-1:historia:industriella-revolutionen",
    );
  });

  it("serializes and parses checklist state", () => {
    const serialized = serializeChecklistState({
      progressMap: {
        a: "done",
      },
      teacherNotes: "test",
      updatedAt: "2026-04-20T00:00:00.000Z",
    });

    const parsed = parseStoredChecklist(serialized);

    expect(parsed).toEqual({
      progressMap: {
        a: "done",
      },
      teacherNotes: "test",
      updatedAt: "2026-04-20T00:00:00.000Z",
    });
  });

  it("returns null for invalid payload", () => {
    expect(parseStoredChecklist("{invalid")).toBeNull();
    expect(parseStoredChecklist(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("exports and imports planning entries for the same user scope", () => {
    const store = new Map<string, string>();

    const storage = {
      get length() {
        return store.size;
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    } as unknown as Storage;

    const userKey = getPlanningStorageKey("user-1", "historia", "industriella-revolutionen");
    const otherUserKey = getPlanningStorageKey("user-2", "historia", "industriella-revolutionen");

    storage.setItem(
      userKey,
      serializeChecklistState({
        progressMap: { a: "done" },
        teacherNotes: "U1",
        updatedAt: "2026-04-20T00:00:00.000Z",
      }),
    );
    storage.setItem(
      otherUserKey,
      serializeChecklistState({
        progressMap: { a: "done" },
        teacherNotes: "U2",
        updatedAt: "2026-04-20T00:00:00.000Z",
      }),
    );

    const exported = buildPlanningExportPayload(storage, "user-1");

    expect(exported.entries).toHaveLength(1);
    expect(exported.entries[0]?.key).toBe(userKey);

    const parsed = parsePlanningExportPayload(JSON.stringify(exported));
    expect(parsed).not.toBeNull();

    storage.removeItem(userKey);
    const imported = applyPlanningImportPayload(storage, "user-1", parsed!);
    expect(imported).toBe(1);
    expect(parseStoredChecklist(storage.getItem(userKey))?.teacherNotes).toBe("U1");
  });
});
