import { describe, expect, it } from "vitest";
import { mergeCustomNames, parseCustomNamesInput } from "@/lib/gdpr/custom-names";

describe("custom names helpers", () => {
  it("parses comma-, semicolon-, and newline-separated names", () => {
    expect(parseCustomNamesInput("Mohammed, Amir;\nFatima\r\nNour")).toEqual([
      "Mohammed",
      "Amir",
      "Fatima",
      "Nour",
    ]);
  });

  it("merges names without case-insensitive duplicates", () => {
    expect(mergeCustomNames(["Mohammed"], ["mohammed", "Amir", "  Fatima  "])).toEqual([
      "Mohammed",
      "Amir",
      "Fatima",
    ]);
  });
});
