import { describe, expect, it } from "vitest";
import {
  abbreviateHash,
  formatProgressSummary,
  isPlanningClientClockAhead,
  isPlanningSyncConflictResolved,
  parsePlanningSyncConflictFilter,
  summarizeProgressMap,
} from "@/lib/planning/admin";

describe("planning sync admin helpers", () => {
  it("parses conflict filters with unresolved as the safe default", () => {
    expect(parsePlanningSyncConflictFilter("resolved")).toBe("resolved");
    expect(parsePlanningSyncConflictFilter("all")).toBe("all");
    expect(parsePlanningSyncConflictFilter("unknown")).toBe("unresolved");
    expect(parsePlanningSyncConflictFilter(undefined)).toBe("unresolved");
  });

  it("summarizes progress maps without exposing raw item ids", () => {
    const summary = summarizeProgressMap({
      a: "done",
      b: "in_progress",
      c: "not_started",
      d: "unexpected",
    });

    expect(summary).toEqual({
      done: 1,
      inProgress: 1,
      notStarted: 1,
      other: 1,
      total: 4,
    });
    expect(formatProgressSummary(summary)).toBe("4 punkter: 1 klara, 1 pågår, 1 ej startade, 1 okända");
  });

  it("detects resolved conflicts and abbreviates note hashes for display", () => {
    expect(isPlanningSyncConflictResolved({ resolved_at: "2026-04-26T10:00:00.000Z" })).toBe(true);
    expect(isPlanningSyncConflictResolved({ resolved_at: null })).toBe(false);
    expect(abbreviateHash("1234567890abcdef")).toBe("1234567890ab");
    expect(abbreviateHash(null)).toBe("saknas");
  });

  it("flags client clock drift only when the client timestamp is clearly ahead", () => {
    expect(
      isPlanningClientClockAhead({
        client_updated_at: "2026-04-26T10:06:01.000Z",
        updated_at: "2026-04-26T10:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isPlanningClientClockAhead({
        client_updated_at: "2026-04-26T10:04:59.000Z",
        updated_at: "2026-04-26T10:00:00.000Z",
      }),
    ).toBe(false);
  });
});
