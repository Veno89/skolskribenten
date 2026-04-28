import {
  PLANNING_GRADE_BANDS,
  SUBJECT_CURRICULUM,
  type PlanningArea,
  type PlanningGradeBand,
} from "@/lib/planning/curriculum";

type PlanningSubject = (typeof SUBJECT_CURRICULUM)[number];

interface Props {
  activeArea: PlanningArea;
  availableSubjects: PlanningSubject[];
  gradeBand: PlanningGradeBand;
  onAreaChange: (areaId: string) => void;
  onGradeBandChange: (gradeBand: string) => void;
  onSubjectChange: (subjectId: string) => void;
  subject: PlanningSubject;
}

export function PlanningSelector({
  activeArea,
  availableSubjects,
  gradeBand,
  onAreaChange,
  onGradeBandChange,
  onSubjectChange,
  subject,
}: Props): JSX.Element {
  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--ss-neutral-900)]">Årsspann</span>
          <select
            className="h-11 w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
            value={gradeBand}
            onChange={(event) => onGradeBandChange(event.target.value)}
          >
            {PLANNING_GRADE_BANDS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--ss-neutral-900)]">Ämne</span>
          <select
            className="h-11 w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
            value={subject.id}
            onChange={(event) => onSubjectChange(event.target.value)}
          >
            {availableSubjects.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-[var(--ss-neutral-900)]">Område</span>
          <select
            className="h-11 w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
            value={activeArea.id}
            onChange={(event) => onAreaChange(event.target.value)}
          >
            {subject.areas.map((areaOption) => (
              <option key={areaOption.id} value={areaOption.id}>
                {areaOption.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-4 text-xs leading-6 text-muted-foreground">{activeArea.description}</p>
    </>
  );
}
