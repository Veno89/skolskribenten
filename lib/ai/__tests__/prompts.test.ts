import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "../prompts";

describe("getSystemPrompt", () => {
  it("includes the teacher-focused role and Swedish school context", () => {
    const prompt = getSystemPrompt("larlogg");

    expect(prompt).toContain("Skolskribentens AI-assistent för svenska lärare i grundskolan");
    expect(prompt).toContain("Lgr22 är relevant främst när läraren dokumenterar lärande");
    expect(prompt).toContain("skriv inte som om elevhälsobedömningar redan är gjorda");
  });

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

  it("includes the Unikum-specific structure", () => {
    const prompt = getSystemPrompt("unikum");

    expect(prompt).toContain("MALL: UNIKUM-DOKUMENTATION");
    expect(prompt).toContain("Sammanhang:");
    expect(prompt).toContain("Koppling till lärande/mål:");
  });

  it("includes the dedicated lesson-planning structure", () => {
    const prompt = getSystemPrompt("lektionsplanering");

    expect(prompt).toContain("MALL: LEKTIONSPLANERING / NÄSTA UNDERVISNINGSSTEG");
    expect(prompt).toContain("## Planeringsöversikt");
    expect(prompt).toContain("**Lektionsgång steg för steg**");
    expect(prompt).toContain("> Kort notis om vad läraren särskilt bör följa upp i nästa lektion.");
  });

  it("leaves the prompt untouched when no settings are saved", () => {
    const prompt = getSystemPrompt("incidentrapport");

    expect(prompt).not.toContain("LÄRARINSTÄLLNINGAR FÖR DEN HÄR GENERERINGEN");
  });
});
