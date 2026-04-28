"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePlanningCloudSync } from "@/hooks/planning/usePlanningCloudSync";
import { usePlanningLocalState } from "@/hooks/planning/usePlanningLocalState";
import { usePlanningSyncQueue } from "@/hooks/planning/usePlanningSyncQueue";
import { isPlanningScopeMatch } from "@/hooks/planning/types";
import type { PlanningArea, PlanningSubjectId } from "@/lib/planning/curriculum";
import {
  analyzeChecklistGap,
  type ChecklistProgressMap,
} from "@/lib/planning/gap-analysis";
import {
  createPlanningSyncQueueItem,
  markPlanningSyncItemConflict,
  markPlanningSyncItemFailed,
  markPlanningSyncItemPending,
  parsePlanningSyncQueue,
  removePlanningSyncItem,
  upsertPlanningSyncItem,
  type PlanningSyncConflictState,
} from "@/lib/planning/sync-queue";

export type CloudStatus = "idle" | "syncing" | "synced" | "error" | "conflict";

type PlanningSyncResponsePayload = {
  code?: string;
  conflictId?: string | null;
  error?: string;
  mergedState?: {
    progressMap: ChecklistProgressMap;
    revision?: number | null;
    serverUpdatedAt?: string;
    teacherNotes: string;
    updatedAt: string;
  };
  state?: {
    progressMap: ChecklistProgressMap;
    revision?: number | null;
    serverUpdatedAt?: string;
    teacherNotes: string;
    updatedAt: string;
  };
};

function buildConflictState(
  localState: {
    progressMap: ChecklistProgressMap;
    revision?: number | null;
    teacherNotes: string;
    updatedAt: string;
  },
  payload: PlanningSyncResponsePayload,
): PlanningSyncConflictState | null {
  if (!payload.state) {
    return null;
  }

  return {
    conflictId: payload.conflictId ?? null,
    localState,
    mergedState: payload.mergedState,
    serverState: payload.state,
  };
}

export function usePlanningChecklist(params: {
  area: PlanningArea;
  cloudSyncEnabled: boolean;
  subjectId: PlanningSubjectId;
  userId: string;
}) {
  const { area, cloudSyncEnabled, subjectId, userId } = params;
  const currentScope = useMemo(() => ({ areaId: area.id, subjectId }), [area.id, subjectId]);
  const {
    appendSyncLog,
    cloudStatus,
    isFlushingQueueRef,
    lastSyncedAt,
    pendingConflict,
    setCloudStatus,
    setLastSyncedAt,
    setPendingConflict,
    syncLog,
  } = usePlanningCloudSync();
  const {
    applyStateToActiveArea,
    cloudRevision,
    hasHydratedLocal,
    hydrateChecklistFromStorage,
    progressMap,
    resetChecklist,
    setCloudRevision,
    setItemStatus,
    setUpdatedAt,
    teacherNotes,
    updatedAt,
    updateTeacherNotes,
    writeStoredChecklistState,
  } = usePlanningLocalState({
    area,
    currentScope,
    subjectId,
    userId,
  });
  const {
    currentQueuedConflict,
    currentQueuedItem,
    enqueueSyncPayload,
    hasPendingQueuedItem,
    persistQueueState,
    queuedItems,
    queuedSyncCount,
    refreshQueueState,
    syncQueueKey,
  } = usePlanningSyncQueue({
    cloudRevision,
    currentScope,
    userId,
  });
  const lastSyncedPayloadKeyRef = useRef<string | null>(null);

  const getConflictStrategyLabel = (strategy: "server" | "merged" | "local") =>
    strategy === "server"
      ? "molnets version"
      : strategy === "merged"
        ? "kombinerat förslag"
        : "din senaste version";

  const postPlanningChecklistState = async (payload: {
    areaId: string;
    baseRevision?: number | null;
    progressMap: ChecklistProgressMap;
    resolvedConflictId?: string | null;
    resolutionStrategy?: "server" | "merged" | "local" | null;
    subjectId: string;
    teacherNotes: string;
    updatedAt: string;
  }) => {
    const response = await fetch("/api/planning/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let responsePayload: PlanningSyncResponsePayload = {};

    try {
      responsePayload = (await response.json()) as PlanningSyncResponsePayload;
    } catch {
      responsePayload = {};
    }

    return { response, responsePayload };
  };

  const resolveConflictForScope = (
    target: { areaId: string; subjectId: string },
    strategy: "server" | "merged" | "local",
    conflictState: PlanningSyncConflictState,
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const existingQueueItem =
      currentQueue.find((item) => isPlanningScopeMatch(item, target)) ??
      createPlanningSyncQueueItem({
        areaId: target.areaId,
        baseRevision: conflictState.localState.revision ?? null,
        enqueuedAt: new Date().toISOString(),
        progressMap: conflictState.localState.progressMap,
        revision: conflictState.localState.revision ?? null,
        subjectId: target.subjectId,
        teacherNotes: conflictState.localState.teacherNotes,
        updatedAt: conflictState.localState.updatedAt,
      });

    const baseState =
      strategy === "server"
        ? conflictState.serverState
        : strategy === "merged" && conflictState.mergedState
          ? conflictState.mergedState
          : conflictState.localState;

    const nextUpdatedAt = strategy === "server" ? baseState.updatedAt : new Date().toISOString();
    const nextState = {
      progressMap: baseState.progressMap,
      revision: conflictState.serverState.revision ?? null,
      teacherNotes: baseState.teacherNotes,
      updatedAt: nextUpdatedAt,
    };
    const pendingItem = markPlanningSyncItemPending(existingQueueItem, {
      baseRevision: conflictState.serverState.revision ?? null,
      enqueuedAt: nextUpdatedAt,
      progressMap: nextState.progressMap,
      resolvedConflictId: conflictState.conflictId ?? null,
      resolutionStrategy: strategy,
      revision: conflictState.serverState.revision ?? null,
      teacherNotes: nextState.teacherNotes,
      updatedAt: nextState.updatedAt,
    });
    const nextQueue = upsertPlanningSyncItem(currentQueue, pendingItem);

    writeStoredChecklistState(target, nextState);
    persistQueueState(nextQueue);
    applyStateToActiveArea(target, nextState);
    if (isPlanningScopeMatch(target, currentScope)) {
      setPendingConflict(null);
      setCloudStatus("idle");
    }

    appendSyncLog(
      `Konflikt löst: ${getConflictStrategyLabel(strategy)} valdes för ${target.subjectId}/${target.areaId}.`,
    );

    void flushCloudQueue();
  };

  const discardQueuedItem = (target: { areaId: string; subjectId: string }) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const nextQueue = removePlanningSyncItem(currentQueue, target);

    persistQueueState(nextQueue);

    if (isPlanningScopeMatch(target, currentScope)) {
      setPendingConflict(null);
      setCloudStatus("idle");
    }

    appendSyncLog(`Köad planering togs bort för ${target.subjectId}/${target.areaId}.`);
  };

  const retryQueuedItem = (target: { areaId: string; subjectId: string }) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const existingItem = currentQueue.find((item) => isPlanningScopeMatch(item, target));

    if (!existingItem || existingItem.status === "conflict") {
      return;
    }

    const nextQueue = upsertPlanningSyncItem(
      currentQueue,
      markPlanningSyncItemPending(existingItem, {
        enqueuedAt: new Date().toISOString(),
      }),
    );

    persistQueueState(nextQueue);
    appendSyncLog(`Ny synkförsök köad för ${target.subjectId}/${target.areaId}.`);
    void flushCloudQueue();
  };

  async function flushCloudQueue() {
    if (!cloudSyncEnabled || typeof window === "undefined" || isFlushingQueueRef.current) {
      return;
    }

    const queue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    if (queue.length === 0) {
      return;
    }

    isFlushingQueueRef.current = true;

    let nextQueue = [...queue];
    let hadConflict = false;
    let hadFailure = false;
    let newConflictDetected = false;
    let processedAny = false;

    if (!currentQueuedConflict) {
      setCloudStatus("syncing");
    }

    try {
      for (const item of queue) {
        if (item.status === "conflict") {
          hadConflict = true;
          continue;
        }

        processedAny = true;
        const attemptedAt = new Date().toISOString();

        try {
          const { response, responsePayload } = await postPlanningChecklistState({
            areaId: item.areaId,
            baseRevision: item.baseRevision,
            progressMap: item.progressMap,
            resolvedConflictId: item.resolvedConflictId,
            resolutionStrategy: item.resolutionStrategy,
            subjectId: item.subjectId,
            teacherNotes: item.teacherNotes,
            updatedAt: item.updatedAt,
          });

          if (response.status === 409) {
            const conflictState = buildConflictState(
              {
                progressMap: item.progressMap,
                revision: item.baseRevision,
                teacherNotes: item.teacherNotes,
                updatedAt: item.updatedAt,
              },
              responsePayload,
            );

            if (!conflictState) {
              nextQueue = upsertPlanningSyncItem(
                nextQueue,
                markPlanningSyncItemFailed(item, {
                  attemptedAt,
                  errorMessage: responsePayload.error ?? "Konflikt upptäcktes men kunde inte tolkas.",
                }),
              );
              hadFailure = true;
              continue;
            }

            nextQueue = upsertPlanningSyncItem(
              nextQueue,
              markPlanningSyncItemConflict(item, {
                attemptedAt,
                conflictState,
                errorMessage: responsePayload.error,
              }),
            );
            hadConflict = true;
            newConflictDetected = true;

            if (isPlanningScopeMatch(item, currentScope)) {
              setPendingConflict(conflictState);
              setCloudStatus("conflict");
            }

            appendSyncLog(
              `Synken behöver ditt val för ${item.subjectId}/${item.areaId} innan den kan fortsätta.`,
            );
            continue;
          }

          if (!response.ok) {
            nextQueue = upsertPlanningSyncItem(
              nextQueue,
              markPlanningSyncItemFailed(item, {
                attemptedAt,
                errorMessage: responsePayload.error ?? "Cloudsync sparning misslyckades.",
              }),
            );
            hadFailure = true;
            appendSyncLog(`Synkfel för ${item.subjectId}/${item.areaId}.`);

            if (response.status === 401 || response.status === 403) {
              setCloudStatus("error");
              break;
            }

            continue;
          }

          nextQueue = removePlanningSyncItem(nextQueue, item);

          if (responsePayload.state) {
            writeStoredChecklistState(item, responsePayload.state);
          }

          if (isPlanningScopeMatch(item, currentScope)) {
            setCloudRevision(responsePayload.state?.revision ?? item.revision ?? item.baseRevision ?? null);
            setLastSyncedAt(attemptedAt);
            if (!currentQueuedConflict) {
              setCloudStatus("synced");
            }
          }
        } catch {
          nextQueue = upsertPlanningSyncItem(
            nextQueue,
            markPlanningSyncItemFailed(item, {
              attemptedAt,
              errorMessage: "Nätverksfel vid replay av cloudsync.",
            }),
          );
          hadFailure = true;
          setCloudStatus("error");
          appendSyncLog(`Nätverksfel i synkkön för ${item.subjectId}/${item.areaId}.`);
          break;
        }
      }
    } finally {
      persistQueueState(nextQueue);

      if (processedAny && nextQueue.length === 0 && !hadConflict && !hadFailure) {
        appendSyncLog("Synkkö tömd.");
      } else if (newConflictDetected) {
        appendSyncLog("Minst en köad planering behöver ditt val innan synken kan fortsätta.");
      } else if (hadFailure) {
        appendSyncLog("Synkkö delvis kvar efter flush.");
      }

      isFlushingQueueRef.current = false;
    }
  }

  useEffect(() => {
    refreshQueueState();
  }, [syncQueueKey]);

  useEffect(() => {
    const nextConflict = currentQueuedConflict?.conflictState ?? null;
    setPendingConflict(nextConflict);

    if (nextConflict) {
      setCloudStatus("conflict");
      return;
    }

    setCloudStatus((current) => (current === "conflict" ? "idle" : current));
  }, [currentQueuedConflict]);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal || typeof window === "undefined") {
      return;
    }

    let active = true;

    const loadCloudState = async () => {
      setCloudStatus((current) => (current === "conflict" ? current : "syncing"));

      try {
        const response = await fetch(
          `/api/planning/checklist?subjectId=${encodeURIComponent(subjectId)}&areaId=${encodeURIComponent(area.id)}`,
          { method: "GET", cache: "no-store" },
        );

        if (!response.ok) {
          setCloudStatus((current) => (current === "conflict" ? current : "error"));
          return;
        }

        const payload = (await response.json()) as {
          state: {
            progressMap: ChecklistProgressMap;
            revision?: number | null;
            serverUpdatedAt?: string;
            teacherNotes: string;
            updatedAt: string;
          } | null;
        };

        if (!active) {
          return;
        }

        const queuedVersionForCurrent = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey)).find(
          (item) => isPlanningScopeMatch(item, currentScope),
        );

        if (!payload.state) {
          setCloudRevision(null);
          setCloudStatus((current) => (current === "conflict" ? current : "synced"));
          setLastSyncedAt(new Date().toISOString());
          appendSyncLog("Cloudsync hämtning klar.");
          return;
        }

        if (queuedVersionForCurrent) {
          setCloudStatus(queuedVersionForCurrent.status === "conflict" ? "conflict" : "synced");
          appendSyncLog("Cloudsync hämtning klar. Lokal köad version behölls.");
          return;
        }

        const localDate = updatedAt ? new Date(updatedAt).getTime() : 0;
        const cloudDate = payload.state.updatedAt ? new Date(payload.state.updatedAt).getTime() : 0;

        if (cloudDate > localDate) {
          applyStateToActiveArea(currentScope, payload.state);
        }

        lastSyncedPayloadKeyRef.current = `${subjectId}:${area.id}:${payload.state.updatedAt}:${payload.state.revision ?? "none"}`;
        setCloudRevision(payload.state.revision ?? null);
        setCloudStatus((current) => (current === "conflict" ? current : "synced"));
        setLastSyncedAt(new Date().toISOString());
        appendSyncLog("Cloudsync hämtning klar.");
      } catch {
        if (active) {
          setCloudStatus((current) => (current === "conflict" ? current : "error"));
          appendSyncLog("Cloudsync hämtning misslyckades.");
        }
      }
    };

    void loadCloudState();

    return () => {
      active = false;
    };
  }, [area, cloudSyncEnabled, hasHydratedLocal, subjectId, syncQueueKey, updatedAt]);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal || typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      void flushCloudQueue();
    };

    window.addEventListener("online", handleOnline);
    void flushCloudQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [cloudSyncEnabled, hasHydratedLocal, syncQueueKey]);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal || typeof window === "undefined" || !hasPendingQueuedItem) {
      return;
    }

    void flushCloudQueue();
  }, [cloudSyncEnabled, hasHydratedLocal, hasPendingQueuedItem, syncQueueKey]);

  const hasCurrentQueuedItem = Boolean(currentQueuedItem);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal || hasCurrentQueuedItem) {
      return;
    }

    const syncUpdatedAt = updatedAt || new Date().toISOString();
    const syncPayloadKey = `${subjectId}:${area.id}:${syncUpdatedAt}:${cloudRevision ?? "none"}`;

    if (lastSyncedPayloadKeyRef.current === syncPayloadKey) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setCloudStatus("syncing");

      try {
        const { response, responsePayload } = await postPlanningChecklistState({
          areaId: area.id,
          baseRevision: cloudRevision,
          progressMap,
          subjectId,
          teacherNotes,
          updatedAt: syncUpdatedAt,
        });

        if (response.status === 409) {
          const conflictState = buildConflictState(
            {
              progressMap: { ...progressMap },
              revision: cloudRevision,
              teacherNotes,
              updatedAt: syncUpdatedAt,
            },
            responsePayload,
          );

          if (conflictState) {
            setPendingConflict(conflictState);
            enqueueSyncPayload({
              areaId: area.id,
              baseRevision: cloudRevision,
              progressMap: conflictState.localState.progressMap,
              revision: cloudRevision,
              subjectId,
              teacherNotes: conflictState.localState.teacherNotes,
              updatedAt: conflictState.localState.updatedAt,
            });

            if (typeof window !== "undefined") {
              const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
              const queuedItem =
                currentQueue.find((item) => isPlanningScopeMatch(item, currentScope)) ??
                createPlanningSyncQueueItem({
                  areaId: area.id,
                  baseRevision: cloudRevision,
                  enqueuedAt: syncUpdatedAt,
                  progressMap: conflictState.localState.progressMap,
                  revision: cloudRevision,
                  subjectId,
                  teacherNotes: conflictState.localState.teacherNotes,
                  updatedAt: conflictState.localState.updatedAt,
                });

              const nextQueue = upsertPlanningSyncItem(
                currentQueue,
                markPlanningSyncItemConflict(queuedItem, {
                  attemptedAt: syncUpdatedAt,
                  conflictState,
                  errorMessage: responsePayload.error,
                }),
              );

              persistQueueState(nextQueue);
            }
          }

          setCloudStatus("conflict");
          appendSyncLog(
            "Det finns både en sparad molnversion och en ny version på den här enheten. Välj vilken som ska gälla.",
          );
          return;
        }

        if (!response.ok) {
          setCloudStatus("error");
          appendSyncLog("Cloudsync sparning misslyckades.");
          enqueueSyncPayload({
            areaId: area.id,
            baseRevision: cloudRevision,
            progressMap,
            revision: cloudRevision,
            subjectId,
            teacherNotes,
            updatedAt: syncUpdatedAt,
          });
          appendSyncLog("Lagt i synkkö för senare försök.");
          return;
        }

        if (typeof window !== "undefined") {
          const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
          const nextQueue = removePlanningSyncItem(currentQueue, currentScope);
          if (nextQueue.length !== currentQueue.length) {
            persistQueueState(nextQueue);
          }
        }

        const nextRevision = responsePayload.state?.revision ?? cloudRevision;
        lastSyncedPayloadKeyRef.current = `${subjectId}:${area.id}:${syncUpdatedAt}:${nextRevision ?? "none"}`;
        setPendingConflict(null);
        setCloudRevision(nextRevision);
        setUpdatedAt(syncUpdatedAt);
        setCloudStatus("synced");
        setLastSyncedAt(syncUpdatedAt);
        appendSyncLog("Cloudsync sparning klar.");
      } catch {
        setCloudStatus("error");
        appendSyncLog("Cloudsync sparning misslyckades.");
        enqueueSyncPayload({
          areaId: area.id,
          baseRevision: cloudRevision,
          progressMap,
          revision: cloudRevision,
          subjectId,
          teacherNotes,
          updatedAt: syncUpdatedAt,
        });
        appendSyncLog("Lagt i synkkö för senare försök.");
      }
    }, 1700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    area.id,
    cloudRevision,
    cloudSyncEnabled,
    hasCurrentQueuedItem,
    hasHydratedLocal,
    subjectId,
    updatedAt,
  ]);

  const gapAnalysis = useMemo(() => analyzeChecklistGap(area, progressMap), [area, progressMap]);

  const retryCloudSync = () => {
    appendSyncLog("Manuell sync-retry startad.");
    void flushCloudQueue();
  };

  const resolveConflict = (strategy: "server" | "merged" | "local") => {
    if (!pendingConflict) {
      return;
    }

    resolveConflictForScope(currentScope, strategy, pendingConflict);
  };

  const resolveQueuedConflict = (
    target: { areaId: string; subjectId: string },
    strategy: "server" | "merged" | "local",
  ) => {
    const queueItem = queuedItems.find(
      (item) => isPlanningScopeMatch(item, target) && item.status === "conflict" && item.conflictState,
    );

    if (!queueItem?.conflictState) {
      return;
    }

    resolveConflictForScope(target, strategy, queueItem.conflictState);
  };

  return {
    cloudStatus,
    discardQueuedItem,
    flushCloudQueue,
    gapAnalysis,
    lastSyncedAt,
    pendingConflict,
    progressMap,
    queuedItems,
    queuedSyncCount,
    reloadChecklistFromStorage: hydrateChecklistFromStorage,
    resetChecklist,
    resolveConflict,
    resolveQueuedConflict,
    retryCloudSync,
    retryQueuedItem,
    setItemStatus,
    setTeacherNotes: updateTeacherNotes,
    syncLog,
    teacherNotes,
  };
}
