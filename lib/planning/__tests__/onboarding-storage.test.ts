import { describe, expect, it } from "vitest";
import {
  getDefaultPlanningOnboardingState,
  getPlanningOnboardingKey,
  parsePlanningOnboardingState,
  serializePlanningOnboardingState,
} from "@/lib/planning/onboarding-storage";

describe("planning onboarding storage", () => {
  it("builds onboarding storage key", () => {
    expect(getPlanningOnboardingKey("user-1")).toBe("skolskribenten:planning-onboarding:user-1");
  });

  it("returns defaults for invalid payload", () => {
    expect(parsePlanningOnboardingState("{invalid")).toEqual(getDefaultPlanningOnboardingState());
  });

  it("serializes and parses known onboarding steps", () => {
    const serialized = serializePlanningOnboardingState({
      completedStepIds: ["choose_scope", "copy_ai_prompt"],
      dismissedAt: "2026-04-20T00:00:00.000Z",
    });

    const parsed = parsePlanningOnboardingState(serialized);

    expect(parsed.completedStepIds).toEqual(["choose_scope", "copy_ai_prompt"]);
    expect(parsed.dismissedAt).toBe("2026-04-20T00:00:00.000Z");
  });

  it("drops unknown step ids", () => {
    const parsed = parsePlanningOnboardingState(
      JSON.stringify({
        completedStepIds: ["choose_scope", "non_existing"],
        dismissedAt: null,
      }),
    );

    expect(parsed.completedStepIds).toEqual(["choose_scope"]);
  });
});
