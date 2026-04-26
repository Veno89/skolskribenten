"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPlanningStorageKey,
  parseStoredChecklist,
  serializeChecklistState,
} from "@/lib/planning/checklist-storage";
import type { PlanningArea, PlanningSubjectId } from "@/lib/planning/curriculum";
import {
  analyzeChecklistGap,
  getDefaultStatusMap,
  type ChecklistProgressMap,
  type ChecklistStatus,
} from "@/lib/planning/gap-analysis";
import {
  createPlanningSyncQueueItem,
  enqueuePlanningSyncItem,
  getPlanningSyncQueueKey,
  markPlanningSyncItemConflict,
  markPlanningSyncItemFailed,
  markPlanningSyncItemPending,
  parsePlanningSyncQueue,
  removePlanningSyncItem,
  serializePlanningSyncQueue,
  upsertPlanningSyncItem,
  type PlanningSyncConflictState,
  type PlanningSyncQueueItem,
} from "@/lib/planning/sync-queue";

type CloudStatus = "idle" | "syncing" | "synced" | "error" | "conflict";

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

function isCurrentScope(
  target: { areaId: string; subjectId: string },
  current: { areaId: string; subjectId: string },
): boolean {
  return target.areaId === current.areaId && target.subjectId === current.subjectId;
}

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
  const [progressMap, setProgressMap] = useState<ChecklistProgressMap>(() => getDefaultStatusMap(area));
  const [teacherNotes, setTeacherNotes] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [cloudRevision, setCloudRevision] = useState<number | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [hasHydratedLocal, setHasHydratedLocal] = useState(false);
  const [queuedSyncCount, setQueuedSyncCount] = useState(0);
  const [queuedItems, setQueuedItems] = useState<PlanningSyncQueueItem[]>([]);
  const [pendingConflict, setPendingConflict] = useState<PlanningSyncConflictState | null>(null);
  const isFlushingQueueRef = useRef(false);

  const storageKey = getPlanningStorageKey(userId, subjectId, area.id);
  const syncQueueKey = getPlanningSyncQueueKey(userId);
  const currentScope = { areaId: area.id, subjectId };
  const currentQueuedItem = queuedItems.find((item) => isCurrentScope(item, currentScope));
  const currentQueuedConflict =
    currentQueuedItem?.status === "conflict" && currentQueuedItem.conflictState ? currentQueuedItem : undefined;
  const hasPendingQueuedItem = queuedItems.some((item) => item.status === "pending");

  const appendSyncLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSyncLog((current) => [`${timestamp} - ${message}`, ...current].slice(0, 6));
  };

  const getConflictStrategyLabel = (strategy: "server" | "merged" | "local") =>
    strategy === "server"
      ? "molnets version"
      : strategy === "merged"
        ? "kombinerat förslag"
        : "din senaste version";

  const refreshQueueState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const queue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    setQueuedSyncCount(queue.length);
    setQueuedItems(queue);
  };

  const persistQueueState = (queue: PlanningSyncQueueItem[]) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(syncQueueKey, serializePlanningSyncQueue(queue));
    setQueuedSyncCount(queue.length);
    setQueuedItems(queue);
  };

  const writeStoredChecklistState = (
    target: { areaId: string; subjectId: string },
    state: {
      progressMap: ChecklistProgressMap;
      revision?: number | null;
      serverUpdatedAt?: string;
      teacherNotes: string;
      updatedAt: string;
    },
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getPlanningStorageKey(userId, target.subjectId as PlanningSubjectId, target.areaId),
      serializeChecklistState(state),
    );
  };

  const applyStateToActiveArea = (target: { areaId: string; subjectId: string }, state: PlanningSyncQueueItem | {
    progressMap: ChecklistProgressMap;
    revision?: number | null;
    teacherNotes: string;
    updatedAt: string;
  }) => {
    if (!isCurrentScope(target, currentScope)) {
      return;
    }

    setProgressMap({ ...getDefaultStatusMap(area), ...state.progressMap });
    setCloudRevision(state.revision ?? null);
    setTeacherNotes(state.teacherNotes);
    setUpdatedAt(state.updatedAt);
  };

  const hydrateChecklistFromStorage = () => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = parseStoredChecklist(window.localStorage.getItem(storageKey));
    const defaults = getDefaultStatusMap(area);

    if (!stored) {
      setProgressMap(defaults);
      setCloudRevision(null);
      setTeacherNotes("");
      setUpdatedAt("");
      setHasHydratedLocal(true);
      return;
    }

    setProgressMap({ ...defaults, ...stored.progressMap });
    setCloudRevision(stored.revision ?? null);
    setTeacherNotes(stored.teacherNotes);
    setUpdatedAt(stored.updatedAt);
    setHasHydratedLocal(true);
  };

  const enqueueSyncPayload = (payload: {
    areaId: string;
    baseRevision?: number | null;
    progressMap: ChecklistProgressMap;
    resolvedConflictId?: string | null;
    resolutionStrategy?: "server" | "merged" | "local" | null;
    revision?: number | null;
    subjectId: string;
    teacherNotes: string;
    updatedAt: string;
  }) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const nextQueue = enqueuePlanningSyncItem(
      currentQueue,
      createPlanningSyncQueueItem({
        ...payload,
        baseRevision: payload.baseRevision ?? payload.revision ?? cloudRevision,
        enqueuedAt: new Date().toISOString(),
      }),
    );

    persistQueueState(nextQueue);
  };

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
      currentQueue.find((item) => isCurrentScope(item, target)) ??
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
    if (isCurrentScope(target, currentScope)) {
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

    if (isCurrentScope(target, currentScope)) {
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
    const existingItem = currentQueue.find((item) => isCurrentScope(item, target));

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

            if (isCurrentScope(item, currentScope)) {
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

          if (isCurrentScope(item, currentScope)) {
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
    if (typeof window === "undefined") {
      return;
    }

    const stored = parseStoredChecklist(window.localStorage.getItem(storageKey));
    const defaults = getDefaultStatusMap(area);

    if (!stored) {
      setProgressMap(defaults);
      setCloudRevision(null);
      setTeacherNotes("");
      setUpdatedAt("");
      setHasHydratedLocal(true);
      return;
    }

    setProgressMap({ ...defaults, ...stored.progressMap });
    setCloudRevision(stored.revision ?? null);
    setTeacherNotes(stored.teacherNotes);
    setUpdatedAt(stored.updatedAt);
    setHasHydratedLocal(true);
  }, [area, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      serializeChecklistState({
        progressMap,
        revision: cloudRevision,
        teacherNotes,
        updatedAt: updatedAt || new Date().toISOString(),
      }),
    );
  }, [cloudRevision, progressMap, storageKey, teacherNotes, updatedAt]);

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
          (item) => isCurrentScope(item, currentScope),
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
          setProgressMap({ ...getDefaultStatusMap(area), ...payload.state.progressMap });
          setTeacherNotes(payload.state.teacherNotes);
          setUpdatedAt(payload.state.updatedAt);
        }

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

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal || currentQueuedItem) {
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const timer = window.setTimeout(async () => {
      setCloudStatus("syncing");

      try {
        const { response, responsePayload } = await postPlanningChecklistState({
          areaId: area.id,
          baseRevision: cloudRevision,
          progressMap,
          subjectId,
          teacherNotes,
          updatedAt: nextUpdatedAt,
        });

        if (response.status === 409) {
          const conflictState = buildConflictState(
            {
              progressMap: { ...progressMap },
              revision: cloudRevision,
              teacherNotes,
              updatedAt: nextUpdatedAt,
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
                currentQueue.find((item) => isCurrentScope(item, currentScope)) ??
                createPlanningSyncQueueItem({
                  areaId: area.id,
                  baseRevision: cloudRevision,
                  enqueuedAt: nextUpdatedAt,
                  progressMap: conflictState.localState.progressMap,
                  revision: cloudRevision,
                  subjectId,
                  teacherNotes: conflictState.localState.teacherNotes,
                  updatedAt: conflictState.localState.updatedAt,
                });

              const nextQueue = upsertPlanningSyncItem(
                currentQueue,
                markPlanningSyncItemConflict(queuedItem, {
                  attemptedAt: nextUpdatedAt,
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
            updatedAt: nextUpdatedAt,
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

        setPendingConflict(null);
        setCloudRevision(responsePayload.state?.revision ?? cloudRevision);
        setUpdatedAt(nextUpdatedAt);
        setCloudStatus("synced");
        setLastSyncedAt(nextUpdatedAt);
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
          updatedAt: nextUpdatedAt,
        });
        appendSyncLog("Lagt i synkkö för senare försök.");
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [area, cloudRevision, cloudSyncEnabled, currentQueuedItem, hasHydratedLocal, progressMap, subjectId, teacherNotes]);

  const gapAnalysis = useMemo(() => analyzeChecklistGap(area, progressMap), [area, progressMap]);

  const setItemStatus = (itemId: string, status: ChecklistStatus) => {
    setProgressMap((current) => ({ ...current, [itemId]: status }));
    setUpdatedAt(new Date().toISOString());
  };

  const resetChecklist = () => {
    const nextMap = getDefaultStatusMap(area);
    setProgressMap(nextMap);
    setTeacherNotes("");
    setUpdatedAt(new Date().toISOString());
  };

  const updateTeacherNotes = (value: string) => {
    setTeacherNotes(value);
    setUpdatedAt(new Date().toISOString());
  };

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
      (item) => isCurrentScope(item, target) && item.status === "conflict" && item.conflictState,
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
