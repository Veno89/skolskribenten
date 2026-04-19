import { describe, expect, it } from "vitest";
import {
  detectPotentialSensitiveContent,
  formatPotentialSensitiveContentMessage,
} from "../server-guard";

describe("detectPotentialSensitiveContent", () => {
  it("detects obvious unsanitized names and structural PII", () => {
    const findings = detectPotentialSensitiveContent(
      "Erik ringde 070-123 45 67 och mailade erik@example.se efter lektionen.",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "known_name",
          matches: expect.arrayContaining(["Erik"]),
        }),
        expect.objectContaining({ type: "phone" }),
        expect.objectContaining({ type: "email" }),
      ]),
    );
  });

  it("flags capitalized words even at the start of a sentence", () => {
    const findings = detectPotentialSensitiveContent(
      "Vi pratade med Mohammed efter lunch.",
    );

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "capitalized_word",
          matches: ["Mohammed"],
        }),
      ]),
    );
  });

  it("does not flag scrubbed placeholder text with safe capitalized words", () => {
    const findings = detectPotentialSensitiveContent(
      "[Elev 1] arbetade med Matematik i Stockholm.",
    );

    expect(findings).toEqual([]);
  });

  it("does not flag Lärare as a name-like word on its own", () => {
    const findings = detectPotentialSensitiveContent(
      "Lärare hjälpte [Elev 1] under lektionen.",
    );

    expect(findings).toEqual([]);
  });
});

describe("formatPotentialSensitiveContentMessage", () => {
  it("summarizes categories without echoing the original tokens", () => {
    const message = formatPotentialSensitiveContentMessage([
      { type: "known_name", matches: ["Erik"] },
      { type: "phone", matches: ["070-123 45 67"] },
    ]);

    expect(message).toContain("namn");
    expect(message).toContain("telefonnummer");
    expect(message).not.toContain("Erik");
    expect(message).not.toContain("070-123 45 67");
  });

  it("no longer tells the user to manually add names", () => {
    const message = formatPotentialSensitiveContentMessage([
      { type: "capitalized_word", matches: ["Mohammed"] },
    ]);

    expect(message).toContain("Granska texten och försök igen.");
    expect(message).not.toContain("Lägg till fler namn i listan");
  });
});
