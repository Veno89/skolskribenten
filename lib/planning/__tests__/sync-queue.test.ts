import { describe, expect, it } from "vitest";
import {
  createPlanningSyncQueueItem,
  enqueuePlanningSyncItem,
  getPlanningSyncItemKey,
  getPlanningSyncQueueKey,
  markPlanningSyncItemConflict,
  markPlanningSyncItemFailed,
  markPlanningSyncItemPending,
  parsePlanningSyncQueue,
  removePlanningSyncItem,
  serializePlanningSyncQueue,
} from "@/lib/planning/sync-queue";

describe("planning sync queue", () => {
  it("builds queue key", () => {
    expect(getPlanningSyncQueueKey("user-1")).toBe("skolskribenten:planning-sync-queue:user-1");
  });

  it("serializes and parses queue with legacy-safe defaults", () => {
    const serialized = serializePlanningSyncQueue([
      createPlanningSyncQueueItem({
        areaId: "area",
        enqueuedAt: "2026-04-20T00:00:00.000Z",
        progressMap: { a: "done" },
        subjectId: "historia",
        teacherNotes: "note",
        updatedAt: "2026-04-20T00:00:00.000Z",
      }),
    ]);

    const parsed = parsePlanningSyncQueue(serialized);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.subjectId).toBe("historia");
    expect(parsed[0]?.status).toBe("pending");
    expect(parsed[0]?.retryCount).toBe(0);
    expect(parsed[0]?.baseRevision).toBeNull();
    expect(parsed[0]?.resolvedConflictId).toBeNull();
    expect(parsed[0]?.resolutionStrategy).toBeNull();
  });

  it("preserves revision and conflict metadata for replayed resolutions", () => {
    const serialized = serializePlanningSyncQueue([
      {
        areaId: "area",
        baseRevision: 4,
        conflictState: {
          conflictId: "11111111-1111-4111-8111-111111111111",
          localState: {
            progressMap: { a: "in_progress" },
            revision: 3,
            teacherNotes: "local",
            updatedAt: "2026-04-20T00:00:00.000Z",
          },
          serverState: {
            progressMap: { a: "done" },
            revision: 4,
            serverUpdatedAt: "2026-04-20T00:20:00.000Z",
            teacherNotes: "server",
            updatedAt: "2026-04-20T00:10:00.000Z",
          },
        },
        enqueuedAt: "2026-04-20T00:30:00.000Z",
        lastAttemptAt: "2026-04-20T00:40:00.000Z",
        lastError: "conflict",
        progressMap: { a: "done" },
        resolvedConflictId: "11111111-1111-4111-8111-111111111111",
        resolutionStrategy: "server",
        retryCount: 1,
        revision: 4,
        status: "pending",
        subjectId: "historia",
        teacherNotes: "server",
        updatedAt: "2026-04-20T00:10:00.000Z",
      },
    ]);

    const parsed = parsePlanningSyncQueue(serialized);

    expect(parsed[0]).toMatchObject({
      baseRevision: 4,
      resolvedConflictId: "11111111-1111-4111-8111-111111111111",
      resolutionStrategy: "server",
      revision: 4,
    });
    expect(parsed[0]?.conflictState?.conflictId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed[0]?.conflictState?.serverState.revision).toBe(4);
  });

  it("de-duplicates by subject+area when enqueueing", () => {
    const result = enqueuePlanningSyncItem(
      [
        createPlanningSyncQueueItem({
          areaId: "area",
          enqueuedAt: "2026-04-20T00:00:00.000Z",
          progressMap: { a: "in_progress" },
          subjectId: "historia",
          teacherNotes: "old",
          updatedAt: "2026-04-20T00:00:00.000Z",
        }),
      ],
      createPlanningSyncQueueItem({
        areaId: "area",
        enqueuedAt: "2026-04-20T01:00:00.000Z",
        progressMap: { a: "done" },
        subjectId: "historia",
        teacherNotes: "new",
        updatedAt: "2026-04-20T01:00:00.000Z",
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.teacherNotes).toBe("new");
    expect(result[0]?.status).toBe("pending");
  });

  it("marks failed replays with retry metadata", () => {
    const item = createPlanningSyncQueueItem({
      areaId: "area",
      enqueuedAt: "2026-04-20T00:00:00.000Z",
      progressMap: { a: "done" },
      subjectId: "historia",
      teacherNotes: "note",
      updatedAt: "2026-04-20T00:00:00.000Z",
    });

    const failed = markPlanningSyncItemFailed(item, {
      attemptedAt: "2026-04-20T01:00:00.000Z",
      errorMessage: "Serverfel",
    });

    expect(failed.status).toBe("failed");
    expect(failed.retryCount).toBe(1);
    expect(failed.lastError).toBe("Serverfel");
    expect(failed.lastAttemptAt).toBe("2026-04-20T01:00:00.000Z");
  });

  it("stores conflict payloads for later manual resolution", () => {
    const item = createPlanningSyncQueueItem({
      areaId: "area",
      enqueuedAt: "2026-04-20T00:00:00.000Z",
      progressMap: { a: "done" },
      subjectId: "historia",
      teacherNotes: "local",
      updatedAt: "2026-04-20T00:00:00.000Z",
    });

    const conflicted = markPlanningSyncItemConflict(item, {
      attemptedAt: "2026-04-20T01:00:00.000Z",
      conflictState: {
        localState: {
          progressMap: { a: "done" },
          teacherNotes: "local",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
        mergedState: {
          progressMap: { a: "done" },
          teacherNotes: "server\n\n---\n\nlocal",
          updatedAt: "2026-04-20T01:00:00.000Z",
        },
        serverState: {
          progressMap: { a: "in_progress" },
          teacherNotes: "server",
          updatedAt: "2026-04-20T00:30:00.000Z",
        },
      },
    });

    expect(conflicted.status).toBe("conflict");
    expect(conflicted.conflictState?.serverState.teacherNotes).toBe("server");
    expect(conflicted.retryCount).toBe(1);
    expect(conflicted.lastError).toBe("Det finns en nyare version i molnet som behöver ditt val.");
  });

  it("can reset a queued item back to pending and remove it cleanly", () => {
    const base = createPlanningSyncQueueItem({
      areaId: "area",
      enqueuedAt: "2026-04-20T00:00:00.000Z",
      progressMap: { a: "done" },
      subjectId: "historia",
      teacherNotes: "note",
      updatedAt: "2026-04-20T00:00:00.000Z",
    });
    const conflicted = markPlanningSyncItemConflict(base, {
      attemptedAt: "2026-04-20T01:00:00.000Z",
      conflictState: {
        localState: {
          progressMap: { a: "done" },
          teacherNotes: "note",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
        serverState: {
          progressMap: { a: "in_progress" },
          teacherNotes: "server",
          updatedAt: "2026-04-20T00:30:00.000Z",
        },
      },
    });

    const pending = markPlanningSyncItemPending(conflicted, {
      teacherNotes: "retry",
      updatedAt: "2026-04-20T02:00:00.000Z",
    });

    expect(pending.status).toBe("pending");
    expect(pending.conflictState).toBeNull();
    expect(pending.baseRevision).toBe(base.baseRevision);
    expect(pending.resolvedConflictId).toBeNull();
    expect(pending.resolutionStrategy).toBeNull();
    expect(pending.teacherNotes).toBe("retry");
    expect(getPlanningSyncItemKey(pending)).toBe("historia:area");
    expect(removePlanningSyncItem([pending], pending)).toEqual([]);
  });
});
