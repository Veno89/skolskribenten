"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPlanningOnboardingKey,
  parsePlanningOnboardingState,
  serializePlanningOnboardingState,
  type PlanningOnboardingState,
} from "@/lib/planning/onboarding-storage";
import { PLANNING_ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/planning/prompt-school";

export function usePlanningOnboarding(userId: string) {
  const [state, setState] = useState<PlanningOnboardingState>({
    completedStepIds: [],
    dismissedAt: null,
  });
  const [hasHydrated, setHasHydrated] = useState(false);
  const storageKey = getPlanningOnboardingKey(userId);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setState(parsePlanningOnboardingState(window.localStorage.getItem(storageKey)));
    setHasHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, serializePlanningOnboardingState(state));
  }, [hasHydrated, state, storageKey]);

  const completedCount = state.completedStepIds.length;
  const totalCount = PLANNING_ONBOARDING_STEPS.length;
  const isCompleted = completedCount >= totalCount;
  const isVisible = hasHydrated && !state.dismissedAt && !isCompleted;

  const completedStepSet = useMemo(() => new Set(state.completedStepIds), [state.completedStepIds]);

  const toggleStep = (stepId: OnboardingStepId) => {
    setState((current) => {
      const exists = current.completedStepIds.includes(stepId);

      return {
        ...current,
        completedStepIds: exists
          ? current.completedStepIds.filter((value) => value !== stepId)
          : [...current.completedStepIds, stepId],
      };
    });
  };

  const dismiss = () => {
    setState((current) => ({
      ...current,
      dismissedAt: new Date().toISOString(),
    }));
  };

  const reset = () => {
    setState({
      completedStepIds: [],
      dismissedAt: null,
    });
  };

  return {
    completedCount,
    completedStepSet,
    dismiss,
    isCompleted,
    isVisible,
    reset,
    toggleStep,
    totalCount,
  };
}
