"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePlanningOnboarding } from "@/hooks/usePlanningOnboarding";
import { PLANNING_ONBOARDING_STEPS, PROMPT_SCHOOL_RECIPES } from "@/lib/planning/prompt-school";

interface Props {
  userId: string;
}

export function PlanningOnboardingPanel({ userId }: Props): JSX.Element | null {
  const { completedCount, completedStepSet, dismiss, isVisible, reset, toggleStep, totalCount } =
    usePlanningOnboarding(userId);
  const [activeRecipeId, setActiveRecipeId] = useState(PROMPT_SCHOOL_RECIPES[0]?.id ?? "");

  const activeRecipe = useMemo(
    () => PROMPT_SCHOOL_RECIPES.find((item) => item.id === activeRecipeId) ?? PROMPT_SCHOOL_RECIPES[0],
    [activeRecipeId],
  );

  const handleCopyPromptTemplate = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(activeRecipe.template);
      window.alert("Promptmall kopierad.");
    } catch {
      window.alert("Kunde inte kopiera promptmallen automatiskt.");
    }
  };

  if (!isVisible) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-3">
        <p className="text-xs text-muted-foreground">
          Onboarding och promptskola är dold. Du kan återaktivera den när som helst.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Visa igen
        </Button>
      </div>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ss-primary)]">Onboarding</p>
          <h2 className="text-base font-semibold text-[var(--ss-neutral-900)]">
            Kom igång + mini promptskola
          </h2>
          <p className="text-xs text-muted-foreground">
            Klart {completedCount} av {totalCount} steg.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={dismiss}>
          Dölj panel
        </Button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] p-3">
          <p className="text-sm font-medium text-[var(--ss-neutral-900)]">Checklistan</p>
          <ul className="mt-2 space-y-2">
            {PLANNING_ONBOARDING_STEPS.map((step) => {
              const checked = completedStepSet.has(step.id);

              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-left"
                  >
                    <p className="text-xs font-medium text-[var(--ss-neutral-900)]">
                      {checked ? "✅" : "⬜"} {step.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="rounded-2xl border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] p-3">
          <p className="text-sm font-medium text-[var(--ss-neutral-900)]">Promptskola</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROMPT_SCHOOL_RECIPES.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => setActiveRecipeId(recipe.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  recipe.id === activeRecipe.id
                    ? "border-[var(--ss-primary)] bg-[var(--ss-primary-light)] text-[var(--ss-primary-dark)]"
                    : "border-[var(--ss-neutral-200)] bg-white text-[var(--ss-neutral-700)]"
                }`}
              >
                {recipe.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-[var(--ss-neutral-900)]">{activeRecipe.purpose}</p>
          <textarea
            readOnly
            value={activeRecipe.template}
            className="mt-2 min-h-36 w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-xs leading-6"
          />
          <Button type="button" size="sm" className="mt-2" onClick={handleCopyPromptTemplate}>
            Kopiera promptmall
          </Button>
        </article>
      </div>
    </section>
  );
}
