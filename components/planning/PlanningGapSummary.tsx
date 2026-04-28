import { analyzeChecklistGap } from "@/lib/planning/gap-analysis";

type GapAnalysis = ReturnType<typeof analyzeChecklistGap>;

interface Props {
  gapAnalysis: GapAnalysis;
}

export function PlanningGapSummary({ gapAnalysis }: Props): JSX.Element {
  return (
    <>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <StatCard label="Genomfört" value={String(gapAnalysis.doneCount)} tone="done" />
        <StatCard label="Pågår" value={String(gapAnalysis.inProgressCount)} tone="progress" />
        <StatCard label="Ej påbörjat" value={String(gapAnalysis.notStartedCount)} tone="missing" />
      </div>

      <p className="mt-3 text-sm font-medium text-[var(--ss-neutral-900)]">
        Täckningsgrad: {gapAnalysis.completionRate}%
      </p>

      <div className="mt-6 rounded-lg border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] p-4">
        <p className="text-sm font-medium text-[var(--ss-neutral-900)]">Föreslagna luckor just nu</p>
        {gapAnalysis.missingItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Inga tydliga luckor markerade. Lägg fokus på fördjupning eller bedömningsuppgifter.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ss-neutral-900)]">
            {gapAnalysis.missingItems.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "done" | "progress" | "missing";
  value: string;
}): JSX.Element {
  const toneClass =
    tone === "done"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "progress"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";

  return (
    <article className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </article>
  );
}
