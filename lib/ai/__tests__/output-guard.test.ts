import { describe, expect, it } from "vitest";
import { AI_EVAL_FIXTURES } from "@/lib/ai/eval-fixtures";
import { getAiGovernanceMetadata } from "@/lib/ai/governance";
import { extractAiPlaceholders, validateAiOutput } from "@/lib/ai/output-guard";
import { getSystemPrompt } from "@/lib/ai/prompts";

describe("AI output guard", () => {
  it("extracts person and structural placeholders", () => {
    expect(extractAiPlaceholders("[Elev 1] ringde [telefonnummer]. [Elev 1]")).toEqual([
      "[Elev 1]",
      "[telefonnummer]",
    ]);
  });

  it("warns when generated text drops placeholders from the scrubbed input", () => {
    const result = validateAiOutput({
      inputText: "[Elev 1] deltog aktivt i genomgången.",
      outputText: "Eleven deltog aktivt i genomgången.",
    });

    expect(result.passed).toBe(true);
    expect(result.warnings[0]).toContain("[Elev 1]");
  });

  it("blocks generated text that introduces new person placeholders", () => {
    const result = validateAiOutput({
      inputText: "[Elev 1] deltog aktivt.",
      outputText: "[Elev 1] och [Elev 2] deltog aktivt.",
    });

    expect(result.passed).toBe(false);
    expect(result.blockingReasons[0]).toContain("[Elev 2]");
  });

  it("blocks generated text that reintroduces obvious personal data", () => {
    const result = validateAiOutput({
      inputText: "[Elev 1] deltog aktivt.",
      outputText: "Erik deltog aktivt och kan nås på 070-123 45 67.",
    });

    expect(result.passed).toBe(false);
    expect(result.blockingReasons.join(" ")).toContain("personuppgifter");
  });
});

describe("AI governance eval fixtures", () => {
  it("carry versioned model/prompt metadata", () => {
    expect(getAiGovernanceMetadata()).toMatchObject({
      ai_provider: "anthropic",
      output_guard_version: expect.stringContaining("output-guard"),
      prompt_version: expect.stringContaining("prompt"),
    });
  });

  it("keep critical prompt clauses and placeholder expectations under test", () => {
    for (const fixture of AI_EVAL_FIXTURES) {
      const prompt = getSystemPrompt(fixture.templateType);

      for (const expected of fixture.promptMustInclude) {
        expect(prompt).toContain(expected);
      }

      for (const placeholder of fixture.mustPreservePlaceholders) {
        expect(extractAiPlaceholders(fixture.input)).toContain(placeholder);
      }

      for (const forbidden of fixture.forbiddenOutputFragments) {
        expect(fixture.input).not.toContain(forbidden);
      }
    }
  });
});
