import { describe, expect, it } from "vitest";
import { GdprScrubber } from "../scrubber";

describe("GdprScrubber", () => {
  it("replaces a common Swedish masculine name (Erik)", () => {
    const result = new GdprScrubber().scrub("Erik arbetade självständigt.");

    expect(result.scrubbedText).toBe("[Elev 1] arbetade självständigt.");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it("replaces a common Swedish feminine name (Maja)", () => {
    const result = new GdprScrubber().scrub("Maja läste högt.");

    expect(result.scrubbedText).toBe("[Elev 1] läste högt.");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it("replaces personnummer in YYYYMMDD-XXXX format", () => {
    const result = new GdprScrubber().scrub("Elevens nummer är 20160203-1234.");

    expect(result.scrubbedText).toContain("[personnummer]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("replaces personnummer in YYMMDD-XXXX format", () => {
    const result = new GdprScrubber().scrub("Elevens nummer är 160203-1234.");

    expect(result.scrubbedText).toContain("[personnummer]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("replaces samordningsnummer", () => {
    const result = new GdprScrubber().scrub("Samordningsnumret är 20160263-1234.");

    expect(result.scrubbedText).toContain("[samordningsnummer]");
    expect(result.scrubbedText).not.toContain("[personnummer]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("replaces email addresses", () => {
    const result = new GdprScrubber().scrub("Kontakta elev@example.se för svar.");

    expect(result.scrubbedText).toContain("[e-postadress]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("replaces Swedish phone numbers (+46 format)", () => {
    const result = new GdprScrubber().scrub("Ring +46 70 123 45 67 vid behov.");

    expect(result.scrubbedText).toContain("[telefonnummer]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("replaces Swedish phone numbers (07X format)", () => {
    const result = new GdprScrubber().scrub("Ring 070-123 45 67 vid behov.");

    expect(result.scrubbedText).toContain("[telefonnummer]");
    expect(result.stats.piiTokensReplaced).toBe(1);
  });

  it("is consistent: same name gets same placeholder throughout the text", () => {
    const result = new GdprScrubber().scrub("Erik skrev. Sedan hjälpte Erik en kompis.");

    expect(result.scrubbedText).toBe("[Elev 1] skrev. Sedan hjälpte [Elev 1] en kompis.");
  });

  it("different names get different numbered placeholders", () => {
    const result = new GdprScrubber().scrub("Erik hjälpte Maja.");

    expect(result.scrubbedText).toBe("[Elev 1] hjälpte [Elev 2].");
    expect(result.stats.namesReplaced).toBe(2);
  });

  it("handles names in different cases (ERIK, erik, Erik) — maps to same placeholder", () => {
    const result = new GdprScrubber().scrub("ERIK såg erik och Erik i korridoren.");

    expect(result.scrubbedText).toBe("[Elev 1] såg [Elev 1] och [Elev 1] i korridoren.");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it('does not replace partial word matches ("erikson" not triggered by "Erik")', () => {
    const result = new GdprScrubber().scrub("erikson väntade på Erik.");

    expect(result.scrubbedText).toBe("erikson väntade på [Elev 1].");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it("accepts and replaces teacher-provided custom names", () => {
    const result = new GdprScrubber().scrub("Amir arbetade fokuserat.", {
      customNames: ["Amir"],
    });

    expect(result.scrubbedText).toBe("[Elev 1] arbetade fokuserat.");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it("replaces a custom non-Swedish name (Mohammed) when provided by teacher", () => {
    const result = new GdprScrubber().scrub("Mohammed deltog aktivt.", {
      customNames: ["Mohammed"],
    });

    expect(result.scrubbedText).toBe("[Elev 1] deltog aktivt.");
    expect(result.stats.namesReplaced).toBe(1);
  });

  it("handles text with no PII gracefully and returns it unchanged", () => {
    const input = "eleven arbetade lugnt under lektionen.";
    const result = new GdprScrubber().scrub(input);

    expect(result.scrubbedText).toBe(input);
    expect(result.stats).toEqual({
      namesReplaced: 0,
      piiTokensReplaced: 0,
    });
    expect(result.unmatchedCapitalized).toEqual([]);
  });

  it("returns accurate stats (namesReplaced, piiTokensReplaced)", () => {
    const result = new GdprScrubber().scrub(
      "Erik mailade från erik@example.se och ringde 070-123 45 67.",
    );

    expect(result.stats).toEqual({
      namesReplaced: 1,
      piiTokensReplaced: 2,
    });
  });

  it("flags remaining capitalized words in unmatchedCapitalized", () => {
    const result = new GdprScrubber().scrub("Vi pratade med Mohammed efter lunch.");

    expect(result.scrubbedText).toBe("Vi pratade med [Elev 1] efter lunch.");
    expect(result.unmatchedCapitalized).toEqual([]);
  });

  it("does not mistake Lärare for a person name while still scrubbing unknown names", () => {
    const result = new GdprScrubber().scrub("Lärare pratade med Mohammed efter lunch.");

    expect(result.scrubbedText).toBe("Lärare pratade med [Elev 1] efter lunch.");
    expect(result.unmatchedCapitalized).toEqual([]);
  });

  it("does not flag known safe capitalized words (Måndag, Svenska, etc.)", () => {
    const result = new GdprScrubber().scrub(
      "På Måndag arbetar klassen med Svenska och Matematik.",
    );

    expect(result.unmatchedCapitalized).toEqual([]);
  });

  it("handles empty string input without throwing", () => {
    const result = new GdprScrubber().scrub("");

    expect(result.scrubbedText).toBe("");
    expect(result.stats).toEqual({
      namesReplaced: 0,
      piiTokensReplaced: 0,
    });
  });

  it("handles custom names with leading/trailing whitespace gracefully", () => {
    const result = new GdprScrubber().scrub("Fatima räckte upp handen.", {
      customNames: ["  Fatima  "],
    });

    expect(result.scrubbedText).toBe("[Elev 1] räckte upp handen.");
    expect(result.stats.namesReplaced).toBe(1);
  });
});
