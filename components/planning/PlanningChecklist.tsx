import type { PlanningArea } from "@/lib/planning/curriculum";
import type {
  ChecklistProgressMap,
  ChecklistStatus,
} from "@/lib/planning/gap-analysis";

const STATUS_OPTIONS: Array<{ value: ChecklistStatus; label: string }> = [
  { value: "not_started", label: "Inte påbörjat" },
  { value: "in_progress", label: "Pågår" },
  { value: "done", label: "Genomfört" },
];

interface Props {
  area: PlanningArea;
  onStatusChange: (itemId: string, status: ChecklistStatus) => void;
  progressMap: ChecklistProgressMap;
}

export function PlanningChecklist({
  area,
  onStatusChange,
  progressMap,
}: Props): JSX.Element {
  return (
    <div className="mt-6 space-y-3">
      {area.items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-4 text-sm"
        >
          <p className="font-medium text-[var(--ss-neutral-900)]">{item.label}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{item.guidance}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const active = (progressMap[item.id] ?? "not_started") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onStatusChange(item.id, option.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-[var(--ss-primary)] bg-[var(--ss-primary-light)] text-[var(--ss-primary-dark)]"
                      : "border-[var(--ss-neutral-200)] text-[var(--ss-neutral-700)] hover:bg-[var(--ss-neutral-50)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
