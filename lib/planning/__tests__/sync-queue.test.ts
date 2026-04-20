import { describe, expect, it } from "vitest";
import {
  enqueuePlanningSyncItem,
  getPlanningSyncQueueKey,
  parsePlanningSyncQueue,
  serializePlanningSyncQueue,
} from "@/lib/planning/sync-queue";

describe("planning sync queue", () => {
  it("builds queue key", () => {
    expect(getPlanningSyncQueueKey("user-1")).toBe("skolskribenten:planning-sync-queue:user-1");
  });

  it("serializes and parses queue", () => {
    const serialized = serializePlanningSyncQueue([
      {
        areaId: "area",
        enqueuedAt: "2026-04-20T00:00:00.000Z",
        progressMap: { a: "done" },
        subjectId: "historia",
        teacherNotes: "note",
        updatedAt: "2026-04-20T00:00:00.000Z",
      },
    ]);

    const parsed = parsePlanningSyncQueue(serialized);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.subjectId).toBe("historia");
  });

  it("de-duplicates by subject+area when enqueueing", () => {
    const result = enqueuePlanningSyncItem(
      [
        {
          areaId: "area",
          enqueuedAt: "2026-04-20T00:00:00.000Z",
          progressMap: { a: "in_progress" },
          subjectId: "historia",
          teacherNotes: "old",
          updatedAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      {
        areaId: "area",
        enqueuedAt: "2026-04-20T01:00:00.000Z",
        progressMap: { a: "done" },
        subjectId: "historia",
        teacherNotes: "new",
        updatedAt: "2026-04-20T01:00:00.000Z",
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.teacherNotes).toBe("new");
  });
});
