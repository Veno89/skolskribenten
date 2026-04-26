"use client";

import { type ChangeEventHandler, useEffect, useMemo, useState } from "react";
import { DocumentRenderer } from "@/components/drafting/DocumentRenderer";
import { PlanningOnboardingPanel } from "@/components/planning/PlanningOnboardingPanel";
import { Button } from "@/components/ui/button";
import { useCompletion } from "@/hooks/useCompletion";
import { usePlanningChecklist } from "@/hooks/usePlanningChecklist";
import {
  MAX_PLANNING_IMPORT_BYTES,
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

type PlanningWorkspaceMessage = {
  message: string;
  tone: "success" | "error";
};

export function PlanningWorkspace({ cloudSyncEnabled, userId }: Props): JSX.Element {
  const [gradeBand, setGradeBand] = useState<PlanningGradeBand>("7-9");
  const [subjectId, setSubjectId] = useState<PlanningSubjectId>("historia");
  const availableSubjects = useMemo(() => getSubjectsForGradeBand(gradeBand), [gradeBand]);
  const subject =
    availableSubjects.find((candidate) => candidate.id === subjectId) ??
    availableSubjects[0] ??
    SUBJECT_CURRICULUM[0];
  const [areaId, setAreaId] = useState<string>(subject.areas[0]?.id ?? "");
  const [importMessage, setImportMessage] = useState<PlanningWorkspaceMessage | null>(null);

  const activeArea = useMemo(() => {
    const area = getPlanningArea(subject.id, areaId);
    return area ?? subject.areas[0];
  }, [areaId, subject]);

  const {
    cloudStatus,
    discardQueuedItem,
    flushCloudQueue,
    gapAnalysis,
    lastSyncedAt,
    pendingConflict,
    progressMap,
    queuedItems,
    queuedSyncCount,
    reloadChecklistFromStorage,
    resetChecklist,
    resolveConflict,
    resolveQueuedConflict,
    retryCloudSync,
    retryQueuedItem,
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
  const [copyMessage, setCopyMessage] = useState<PlanningWorkspaceMessage | null>(null);

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

  useEffect(() => {
    if (!copyMessage || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyMessage(null);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyMessage]);

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
      setCopyMessage({
        message:
          "AI-underlaget kopierades. Klistra in det i Skrivstationen (Eget dokument) eller generera direkt här.",
        tone: "success",
      });
    } catch {
      setCopyMessage({
        message: "Kunde inte kopiera automatiskt. Markera texten och kopiera manuellt.",
        tone: "error",
      });
    }
  };

  const handleGenerateDirectly = async () => {
    try {
      await complete("", {
        body: {
          templateType: "lektionsplanering",
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
      setCopyMessage({
        message: "Planeringsförslaget kopierades.",
        tone: "success",
      });
    } catch {
      setCopyMessage({
        message: "Kunde inte kopiera planeringsförslaget automatiskt.",
        tone: "error",
      });
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

    if (file.size > MAX_PLANNING_IMPORT_BYTES) {
      setImportMessage({
        message: "Filen är för stor. Exportera om från Skolskribenten och försök igen.",
        tone: "error",
      });
      return;
    }

    const text = await file.text();
    const payload = parsePlanningExportPayload(text);

    if (!payload || typeof window === "undefined") {
      setImportMessage({
        message: "Filen kunde inte läsas. Kontrollera att det är en giltig exportfil.",
        tone: "error",
      });
      return;
    }

    const importedCount = applyPlanningImportPayload(window.localStorage, userId, payload);
    reloadChecklistFromStorage();
    resetDirectCompletion();
    setImportMessage({
      message: `Import klar. ${importedCount} planering(ar) lästes in utan att sidan laddades om.`,
      tone: "success",
    });
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
                        ? "ditt val behövs"
                        : "redo"
              }`
            : "Cloudsync: lokalt läge (Pro krävs för synk mellan enheter)."}
        </p>

        {cloudStatus === "conflict" ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              Det finns både en sparad molnversion och en nyare version på den här enheten.
            </p>
            <p className="mt-1 leading-5">
              Välj vilken version du vill fortsätta med. Det kombinerade förslaget försöker behålla båda,
              men bör granskas innan du litar på det.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("server")}>
                Använd molnets version
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("merged")}>
                Använd kombinerat förslag
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => resolveConflict("local")}>
                Behåll din version
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={retryCloudSync}>
                Försök synka igen
              </Button>
            </div>
            {pendingConflict ? (
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <ConflictCard title="Din senaste version" notes={pendingConflict.localState.teacherNotes} />
                <ConflictCard title="Molnets version" notes={pendingConflict.serverState.teacherNotes} />
                <ConflictCard
                  title="Kombinerat förslag"
                  notes={pendingConflict.mergedState?.teacherNotes ?? "[inget kombinerat förslag kunde skapas]"}
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
                <ul className="mt-2 space-y-2">
                  {queuedItems.map((item) => (
                    <li
                      key={`${item.subjectId}-${item.areaId}-${item.enqueuedAt}`}
                      className="rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-[var(--ss-neutral-900)]">
                            {item.subjectId}/{item.areaId}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Köad {new Date(item.enqueuedAt).toLocaleString("sv-SE")}
                          </p>
                        </div>
                        <QueueStatusBadge status={item.status} />
                      </div>

                      {item.lastError ? (
                        <p className="mt-2 text-[11px] leading-5 text-rose-700">{item.lastError}</p>
                      ) : null}

                      {item.lastAttemptAt ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Senaste försök: {new Date(item.lastAttemptAt).toLocaleString("sv-SE")} · Försök:{" "}
                          {item.retryCount}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.status === "conflict" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveQueuedConflict(
                                  { areaId: item.areaId, subjectId: item.subjectId },
                                  "server",
                                )
                              }
                            >
                              Molnets version
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveQueuedConflict(
                                  { areaId: item.areaId, subjectId: item.subjectId },
                                  "merged",
                                )
                              }
                            >
                              Kombinerat förslag
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                resolveQueuedConflict(
                                  { areaId: item.areaId, subjectId: item.subjectId },
                                  "local",
                                )
                              }
                            >
                              Din version
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => retryQueuedItem({ areaId: item.areaId, subjectId: item.subjectId })}
                          >
                            Försök igen
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => discardQueuedItem({ areaId: item.areaId, subjectId: item.subjectId })}
                        >
                          Ta bort
                        </Button>
                      </div>
                      {item.status === "conflict" ? (
                        <p className="mt-2 text-[11px] leading-5 text-amber-900">
                          Molnets version använder det som redan är sparat. Din version skickar om det du har här.
                          Det kombinerade förslaget försöker behålla båda, men bör granskas.
                        </p>
                      ) : null}
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
        <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">
          Exporterade planeringsfiler kan innehålla egna planeringsanteckningar. Spara dem inte på
          delade enheter och importera bara filer som kommer från ditt eget Skolskribenten-konto.
        </p>
        {copyMessage ? <InlineMessage message={copyMessage.message} tone={copyMessage.tone} /> : null}
        {importMessage ? <InlineMessage message={importMessage.message} tone={importMessage.tone} /> : null}

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
              <DocumentRenderer content={directCompletion} templateType="lektionsplanering" />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function InlineMessage({
  message,
  tone,
}: {
  message: string;
  tone: "success" | "error";
}): JSX.Element {
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

function QueueStatusBadge({
  status,
}: {
  status: "pending" | "failed" | "conflict";
}): JSX.Element {
  const toneClass =
    status === "pending"
      ? "bg-sky-50 text-sky-700"
      : status === "failed"
        ? "bg-rose-50 text-rose-700"
        : "bg-amber-50 text-amber-800";

  const label =
    status === "pending" ? "Väntar på synk" : status === "failed" ? "Behöver nytt försök" : "Val krävs";

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>{label}</span>;
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
