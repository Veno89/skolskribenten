import { describe, expect, it } from "vitest";
import {
  formatGuardPassRate,
  summarizeAiGovernanceEvents,
  type AiUsageEventRow,
} from "@/lib/ai/admin";

function buildEvent(overrides: Partial<AiUsageEventRow> = {}): AiUsageEventRow {
  return {
    ai_model: "claude-test",
    ai_provider: "anthropic",
    created_at: "2026-04-27T10:00:00.000Z",
    output_guard_passed: true,
    output_guard_version: "guard-v1",
    output_guard_warnings: [],
    prompt_version: "prompt-v1",
    template_type: "larlogg",
    ...overrides,
  };
}

describe("AI admin helpers", () => {
  it("summarizes blocked and warning events by prompt/model version", () => {
    const stats = summarizeAiGovernanceEvents([
      buildEvent(),
      buildEvent({
        created_at: "2026-04-27T11:00:00.000Z",
        output_guard_passed: false,
        output_guard_warnings: ["Output verkar innehålla personuppgifter"],
      }),
      buildEvent({
        output_guard_warnings: ["Output saknar placeholder från input: [Elev 1]"],
      }),
    ]);

    expect(stats).toMatchObject({
      blockedCount: 1,
      eventCount: 3,
      latestEventAt: "2026-04-27T11:00:00.000Z",
      warningCount: 2,
    });
    expect(stats.versionRows[0]).toMatchObject({
      blockedCount: 1,
      eventCount: 3,
      warningCount: 2,
    });
    expect(formatGuardPassRate(stats)).toBe("66.7%");
  });
});
