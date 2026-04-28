"use client";

import { type ChangeEventHandler, useEffect, useMemo, useState } from "react";
import { PlanningAiPanel } from "@/components/planning/PlanningAiPanel";
import { PlanningChecklist } from "@/components/planning/PlanningChecklist";
import { PlanningCloudSyncPanel } from "@/components/planning/PlanningCloudSyncPanel";
import { PlanningGapSummary } from "@/components/planning/PlanningGapSummary";
import { PlanningImportExport } from "@/components/planning/PlanningImportExport";
import { PlanningOnboardingPanel } from "@/components/planning/PlanningOnboardingPanel";
import { PlanningSelector } from "@/components/planning/PlanningSelector";
import type { PlanningWorkspaceMessage } from "@/components/planning/types";
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
import { buildPlanningPrompt } from "@/lib/planning/gap-analysis";

interface Props {
  cloudSyncEnabled: boolean;
  userId: string;
}

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
  const [copyMessage, setCopyMessage] = useState<PlanningWorkspaceMessage | null>(null);

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

  const handleAreaChange = (value: string) => {
    setAreaId(value);
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

        <PlanningCloudSyncPanel
          cloudStatus={cloudStatus}
          cloudSyncEnabled={cloudSyncEnabled}
          discardQueuedItem={discardQueuedItem}
          flushCloudQueue={flushCloudQueue}
          lastSyncedAt={lastSyncedAt}
          pendingConflict={pendingConflict}
          queuedItems={queuedItems}
          queuedSyncCount={queuedSyncCount}
          resolveConflict={resolveConflict}
          resolveQueuedConflict={resolveQueuedConflict}
          retryCloudSync={retryCloudSync}
          retryQueuedItem={retryQueuedItem}
          syncLog={syncLog}
        />

        <PlanningSelector
          activeArea={activeArea}
          availableSubjects={availableSubjects}
          gradeBand={gradeBand}
          onAreaChange={handleAreaChange}
          onGradeBandChange={handleGradeBandChange}
          onSubjectChange={handleSubjectChange}
          subject={subject}
        />

        <PlanningGapSummary gapAnalysis={gapAnalysis} />

        <PlanningChecklist
          area={activeArea}
          onStatusChange={setItemStatus}
          progressMap={progressMap}
        />

        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium text-[var(--ss-neutral-900)]">
            Egna anteckningar inför nästa steg
          </label>
          <textarea
            className="min-h-32 w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-sm"
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
            placeholder="Skriv vad som fungerat, vad som varit svårt, och vilka elevbehov du ser."
          />
        </div>

        <PlanningImportExport
          importMessage={importMessage}
          onExport={handleExport}
          onImport={handleImport}
          onResetChecklist={resetChecklist}
        />

        <PlanningAiPanel
          aiPrompt={aiPrompt}
          copyMessage={copyMessage}
          directCompletion={directCompletion}
          directError={directError ?? undefined}
          isDirectLoading={isDirectLoading}
          onCopyGeneratedPlan={handleCopyGeneratedPlan}
          onCopyPrompt={handleCopyPrompt}
          onGenerateDirectly={handleGenerateDirectly}
        />
      </section>
    </main>
  );
}
