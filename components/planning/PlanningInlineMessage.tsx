import type { PlanningWorkspaceMessage } from "@/components/planning/types";

export function PlanningInlineMessage({
  message,
  tone,
}: PlanningWorkspaceMessage): JSX.Element {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      aria-live="polite"
      className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-6 ${toneClass}`}
    >
      {message}
    </p>
  );
}
