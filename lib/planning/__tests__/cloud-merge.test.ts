import { describe, expect, it } from "vitest";
import { mergeProgressMaps, mergeTeacherNotes } from "@/lib/planning/cloud-merge";

describe("cloud merge helpers", () => {
  it("prefers highest-priority status per checklist item", () => {
    const merged = mergeProgressMaps(
      {
        a: "in_progress",
        b: "not_started",
      },
      {
        a: "done",
        b: "in_progress",
      },
    );

    expect(merged).toEqual({
      a: "done",
      b: "in_progress",
    });
  });

  it("merges notes safely without duplicates", () => {
    expect(mergeTeacherNotes("", "Client")).toBe("Client");
    expect(mergeTeacherNotes("Server", "Server")).toBe("Server");
    expect(mergeTeacherNotes("Server", "Client")).toContain("---");
  });
});
