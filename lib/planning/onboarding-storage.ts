import { PLANNING_ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/planning/prompt-school";

export interface PlanningOnboardingState {
  completedStepIds: OnboardingStepId[];
  dismissedAt: string | null;
}

const STORAGE_PREFIX = "skolskribenten:planning-onboarding:";

export function getPlanningOnboardingKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getDefaultPlanningOnboardingState(): PlanningOnboardingState {
  return {
    completedStepIds: [],
    dismissedAt: null,
  };
}

export function parsePlanningOnboardingState(rawValue: string | null): PlanningOnboardingState {
  if (!rawValue) {
    return getDefaultPlanningOnboardingState();
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PlanningOnboardingState>;
    const validStepIds = new Set(PLANNING_ONBOARDING_STEPS.map((step) => step.id));

    const completedStepIds = Array.isArray(parsed.completedStepIds)
      ? parsed.completedStepIds.filter((value): value is OnboardingStepId =>
          typeof value === "string" && validStepIds.has(value as OnboardingStepId),
        )
      : [];

    return {
      completedStepIds,
      dismissedAt: typeof parsed.dismissedAt === "string" ? parsed.dismissedAt : null,
    };
  } catch {
    return getDefaultPlanningOnboardingState();
  }
}

export function serializePlanningOnboardingState(state: PlanningOnboardingState): string {
  return JSON.stringify(state);
}
