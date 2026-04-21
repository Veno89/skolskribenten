"use client";

import { type ChangeEventHandler, useMemo, useState } from "react";
import { DocumentRenderer } from "@/components/drafting/DocumentRenderer";
import { PlanningOnboardingPanel } from "@/components/planning/PlanningOnboardingPanel";
import { Button } from "@/components/ui/button";
import { useCompletion } from "@/hooks/useCompletion";
import { usePlanningChecklist } from "@/hooks/usePlanningChecklist";
import {
  applyPlanningImportPayload,
  buildPlanningExportPayload,
  parsePlanningExportPayload,
} from "@/lib/planning/checklist-storage";
import {
  getPlanningArea,
  getSubjectCurriculum,
  getSubjectsForGradeBand,
  PLANNING_GRADE_BANDS,
  SUBJECT_CURRICULUM,
  type PlanningGradeBand,
  type PlanningSubjectId,
} from "@/lib/planning/curriculum";
import { buildPlanningPrompt, type ChecklistStatus } from "@/lib/planning/gap-analysis";

interface Props {
  cloudSyncEnabled: boolean;
  userId: string;
}

const STATUS_OPTIONS: Array<{ value: ChecklistStatus; label: string }> = [
  { value: "not_started", label: "Inte påbörjat" },
  { value: "in_progress", label: "Pågår" },
  { value: "done", label: "Genomfört" },
];

export function PlanningWorkspace({ cloudSyncEnabled, userId }: Props): JSX.Element {
  const [gradeBand, setGradeBand] = useState<PlanningGradeBand>("7-9");
  const [subjectId, setSubjectId] = useState<PlanningSubjectId>("historia");
  const availableSubjects = useMemo(() => getSubjectsForGradeBand(gradeBand), [gradeBand]);
  const subject =
    availableSubjects.find((candidate) => candidate.id === subjectId) ??
    availableSubjects[0] ??
    SUBJECT_CURRICULUM[0];
  const [areaId, setAreaId] = useState<string>(subject.areas[0]?.id ?? "");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const activeArea = useMemo(() => {
    const area = getPlanningArea(subject.id, areaId);
    return area ?? subject.areas[0];
  }, [areaId, subject]);

  const {
    cloudStatus,
    flushCloudQueue,
    gapAnalysis,
    lastSyncedAt,
    pendingConflict,
    progressMap,
    queuedItems,
    queuedSyncCount,
    resetChecklist,
    resolveConflict,
    retryCloudSync,
    setItemStatus,
    setTeacherNotes,
    syncLog,
    teacherNotes,
  } = usePlanningChecklist({
    area: activeArea,
    cloudSyncEnabled,
    subjectId: subject.id,
    userId,
  });

  const aiPrompt = buildPlanningPrompt({
    subject,
    area: activeArea,
    progressMap,
    teacherNotes,
  });

  const {
    complete,
    completion: directCompletion,
    error: directError,
    isLoading: isDirectLoading,
    reset: resetDirectCompletion,
  } = useCompletion({ api: "/api/ai" });

  const handleGradeBandChange = (value: string) => {
    const nextGradeBand = (PLANNING_GRADE_BANDS.find((candidate) => candidate === value) ??
      PLANNING_GRADE_BANDS[0]) as PlanningGradeBand;
    const nextSubjects = getSubjectsForGradeBand(nextGradeBand);
    const nextSubject = nextSubjects[0] ?? SUBJECT_CURRICULUM[0];

    setGradeBand(nextGradeBand);
    setSubjectId(nextSubject.id);
    setAreaId(nextSubject.areas[0]?.id ?? "");
    resetDirectCompletion();
  };

  const handleSubjectChange = (value: string) => {
    const nextSubject = (getSubjectCurriculum(value as PlanningSubjectId) ??
      SUBJECT_CURRICULUM[0]) as (typeof SUBJECT_CURRICULUM)[number];

    setGradeBand(nextSubject.gradeBand);
    setSubjectId(nextSubject.id);
    setAreaId(nextSubject.areas[0]?.id ?? "");
    resetDirectCompletion();
  };

  const handleCopyPrompt = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(aiPrompt);
      window.alert(
        "AI-underlaget kopierades. Klistra in det i Skrivstationen (Eget dokument) eller generera direkt här.",
      );
    } catch {
      window.alert("Kunde inte kopiera automatiskt. Markera texten och kopiera manuellt.");
    }
  };

  const handleGenerateDirectly = async () => {
    try {
      await complete("", {
        body: {
          templateType: "custom",
          scrubbedInput: aiPrompt,
          scrubberStats: {
            namesReplaced: 0,
            piiTokensReplaced: 0,
          },
        },
      });
    } catch {
      // Hook already exposes error state.
    }
  };

  const handleCopyGeneratedPlan = async () => {
    if (typeof window === "undefined" || !directCompletion) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(directCompletion);
      window.alert("Planeringsförslaget kopierades.");
    } catch {
      window.alert("Kunde inte kopiera planeringsförslaget automatiskt.");
    }
  };

  const handleExport = () => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = buildPlanningExportPayload(window.localStorage, userId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);

    anchor.href = url;
    anchor.download = `skolskribenten-planering-${dateStamp}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    const text = await file.text();
    const payload = parsePlanningExportPayload(text);

    if (!payload || typeof window === "undefined") {
      setImportMessage("Filen kunde inte läsas. Kontrollera att det är en giltig exportfil.");
      return;
    }

    const importedCount = applyPlanningImportPayload(window.localStorage, userId, payload);
    setImportMessage(`Import klar. ${importedCount} planering(ar) lästes in.`);
    window.location.reload();
  };

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-10 lg:px-8">
      <PlanningOnboardingPanel userId={userId} />

      <section className="ss-card p-6 md:p-8">
        <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Vad har jag glömt?</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
          Planerings- och gap-analys
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
          Bocka av vad du har gjort i undervisningen. Du får en tydlig översikt över vad som saknas
          och ett färdigt AI-underlag för nästa planeringssteg.
        </p>

        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {cloudSyncEnabled
            ? `Cloudsync: ${
                cloudStatus === "syncing"
                  ? "synkar..."
                  : cloudStatus === "synced"
                    ? "aktiv"
                    : cloudStatus === "error"
                      ? "fel vid synk"
                      : cloudStatus === "conflict"
                        ? "konflikt upptäckt"
                        : "redo"
              }`
            : "Cloudsync: lokalt läge (Pro krävs för synk mellan enheter)."}
        </p>

        {cloudStatus === "conflict" ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">Cloudsync hittade en konflikt. Välj hur den ska lösas:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("server")}>
                Använd serverversion
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("merged")}>
                Använd sammanfogad
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("local")}>
                Behåll lokal version
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={retryCloudSync}>
                Försök synka igen
              </Button>
            </div>
            {pendingConflict ? (
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <ConflictCard title="Lokal" notes={pendingConflict.localState.teacherNotes} />
                <ConflictCard title="Server" notes={pendingConflict.serverState.teacherNotes} />
                <ConflictCard
                  title="Sammanfogad"
                  notes={pendingConflict.mergedState?.teacherNotes ?? "[saknas]"}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {cloudSyncEnabled ? (
          <div className="mt-2 rounded-xl border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] px-3 py-2 text-xs text-muted-foreground">
            <p>
              Senast synkad: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("sv-SE") : "ingen synk än"}
            </p>
            {syncLog.length > 0 ? (
              <ul className="mt-1 list-disc pl-4">
                {syncLog.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1">Poster i synkkö: {queuedSyncCount}</p>
            {queuedSyncCount > 0 ? (
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={flushCloudQueue}>
                  Synka kö nu
                </Button>
                <ul className="mt-2 list-disc pl-4">
                  {queuedItems.map((item) => (
                    <li key={`${item.subjectId}-${item.areaId}-${item.enqueuedAt}`}>
                      {item.subjectId}/{item.areaId} köad {new Date(item.enqueuedAt).toLocaleString("sv-SE")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-[var(--ss-neutral-900)]">Årsspann</span>
            <select
              className="h-11 w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
              value={gradeBand}
              onChange={(event) => handleGradeBandChange(event.target.value)}
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
              className="h-11 w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
              value={subject.id}
              onChange={(event) => handleSubjectChange(event.target.value)}
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
              className="h-11 w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 text-sm"
              value={activeArea.id}
              onChange={(event) => {
                setAreaId(event.target.value);
                resetDirectCompletion();
              }}
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

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <StatCard label="Genomfört" value={String(gapAnalysis.doneCount)} tone="done" />
          <StatCard label="Pågår" value={String(gapAnalysis.inProgressCount)} tone="progress" />
          <StatCard label="Ej påbörjat" value={String(gapAnalysis.notStartedCount)} tone="missing" />
        </div>

        <p className="mt-3 text-sm font-medium text-[var(--ss-neutral-900)]">
          Täckningsgrad: {gapAnalysis.completionRate}%
        </p>

        <div className="mt-6 space-y-3">
          {activeArea.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-4 text-sm"
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
                      onClick={() => setItemStatus(item.id, option.value)}
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

        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium text-[var(--ss-neutral-900)]">
            Egna anteckningar inför nästa steg
          </label>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-sm"
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
            placeholder="Skriv vad som fungerat, vad som varit svårt, och vilka elevbehov du ser."
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] p-4">
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

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={handleCopyPrompt}>
            Kopiera AI-underlag
          </Button>
          <Button type="button" onClick={handleGenerateDirectly} disabled={isDirectLoading}>
            {isDirectLoading ? "Genererar..." : "Generera direkt här"}
          </Button>
          <Button type="button" variant="outline" onClick={resetChecklist}>
            Återställ checklista
          </Button>
          <Button type="button" variant="outline" onClick={handleExport}>
            Exportera planeringar
          </Button>
          <label className="inline-flex">
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
            <span className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-input bg-background px-6 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              Importera planeringar
            </span>
          </label>
        </div>
        {importMessage ? (
          <p className="mt-3 text-xs leading-6 text-muted-foreground">{importMessage}</p>
        ) : null}

        <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          AI-underlag (för direkt planeringsförslag eller Skrivstationens &quot;Eget dokument&quot;)
        </label>
        <textarea
          readOnly
          value={aiPrompt}
          className="mt-2 min-h-40 w-full rounded-2xl border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-xs leading-6"
        />

        {directError ? (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Något gick fel vid direktgenerering: {directError.message}
          </p>
        ) : null}

        {directCompletion ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--ss-neutral-900)]">Planeringsförslag</p>
                <p className="text-xs leading-6 text-muted-foreground">
                  AI-svaret renderas som ett planeringsutkast i stället för som rå text.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleCopyGeneratedPlan}>
                Kopiera planeringsförslag
              </Button>
            </div>

            <div className="mt-3">
              <DocumentRenderer content={directCompletion} templateType="custom" />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ConflictCard({ notes, title }: { notes: string; title: string }): JSX.Element {
  return (
    <article className="rounded-lg border border-amber-200 bg-white p-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">{title}</p>
      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] text-amber-900">
        {notes || "[inga anteckningar]"}
      </p>
    </article>
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
    <article className="rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </article>
  );
}
