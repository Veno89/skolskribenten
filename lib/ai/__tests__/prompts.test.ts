import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "../prompts";

describe("getSystemPrompt", () => {
  it("appends teacher settings when they are available", () => {
    const prompt = getSystemPrompt("larlogg", {
      userSettings: {
        schoolLevel: "F-3",
        preferredTone: "warm",
      },
    });

    expect(prompt).toContain("LÄRARINSTÄLLNINGAR FÖR DEN HÄR GENERERINGEN");
    expect(prompt).toContain("Anpassa språket för F-3");
    expect(prompt).toContain("varmare och mer stödjande språk");
  });

  it("leaves the prompt untouched when no settings are saved", () => {
    const prompt = getSystemPrompt("incidentrapport");

    expect(prompt).not.toContain("LÄRARINSTÄLLNINGAR FÖR DEN HÄR GENERERINGEN");
  });
});
