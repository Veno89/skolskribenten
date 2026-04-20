"use client";

import { useEffect, useMemo, useState } from "react";
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
  enqueuePlanningSyncItem,
  getPlanningSyncQueueKey,
  parsePlanningSyncQueue,
  serializePlanningSyncQueue,
} from "@/lib/planning/sync-queue";

type CloudStatus = "idle" | "syncing" | "synced" | "error" | "conflict";

type ConflictState = {
  localState: {
    progressMap: ChecklistProgressMap;
    teacherNotes: string;
    updatedAt: string;
  };
  mergedState?: {
    progressMap: ChecklistProgressMap;
    teacherNotes: string;
    updatedAt: string;
  };
  serverState: {
    progressMap: ChecklistProgressMap;
    teacherNotes: string;
    updatedAt: string;
  };
};

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
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [hasHydratedLocal, setHasHydratedLocal] = useState(false);
  const [cloudRetryToken, setCloudRetryToken] = useState(0);
  const [queuedSyncCount, setQueuedSyncCount] = useState(0);
  const [queuedItems, setQueuedItems] = useState<Array<{ areaId: string; enqueuedAt: string; subjectId: string }>>(
    [],
  );
  const [pendingConflict, setPendingConflict] = useState<ConflictState | null>(null);

  const storageKey = getPlanningStorageKey(userId, subjectId, area.id);
  const syncQueueKey = getPlanningSyncQueueKey(userId);

  const appendSyncLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSyncLog((current) => [`${timestamp} - ${message}`, ...current].slice(0, 5));
  };

  const refreshQueueState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const queue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    setQueuedSyncCount(queue.length);
    setQueuedItems(
      queue.map((item) => ({
        areaId: item.areaId,
        enqueuedAt: item.enqueuedAt,
        subjectId: item.subjectId,
      })),
    );
  };

  const enqueueSyncPayload = (payload: {
    areaId: string;
    progressMap: ChecklistProgressMap;
    subjectId: string;
    teacherNotes: string;
    updatedAt: string;
  }) => {
    if (typeof window === "undefined") {
      return;
    }

    const currentQueue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    const nextQueue = enqueuePlanningSyncItem(currentQueue, {
      ...payload,
      enqueuedAt: new Date().toISOString(),
    });

    window.localStorage.setItem(syncQueueKey, serializePlanningSyncQueue(nextQueue));
    refreshQueueState();
  };

  const flushCloudQueue = async () => {
    if (!cloudSyncEnabled || typeof window === "undefined") {
      return;
    }

    const queue = parsePlanningSyncQueue(window.localStorage.getItem(syncQueueKey));
    if (queue.length === 0) {
      return;
    }

    const remaining = [...queue];

    while (remaining.length > 0) {
      const item = remaining[0]!;

      try {
        const response = await fetch("/api/planning/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            areaId: item.areaId,
            progressMap: item.progressMap,
            subjectId: item.subjectId,
            teacherNotes: item.teacherNotes,
            updatedAt: item.updatedAt,
          }),
        });

        if (response.status === 409) {
          appendSyncLog("Konflikt i synkkö - väntar på manuell lösning.");
          break;
        }

        if (!response.ok) {
          break;
        }

        remaining.shift();
      } catch {
        break;
      }
    }

    window.localStorage.setItem(syncQueueKey, serializePlanningSyncQueue(remaining));
    refreshQueueState();

    if (remaining.length === 0) {
      appendSyncLog("Synkkö tömd.");
    } else {
      appendSyncLog("Synkkö delvis kvar efter flush.");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = parseStoredChecklist(window.localStorage.getItem(storageKey));
    const defaults = getDefaultStatusMap(area);

    if (!stored) {
      setProgressMap(defaults);
      setTeacherNotes("");
      setUpdatedAt("");
      setHasHydratedLocal(true);
      return;
    }

    setProgressMap({ ...defaults, ...stored.progressMap });
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
        teacherNotes,
        updatedAt: updatedAt || new Date().toISOString(),
      }),
    );
  }, [progressMap, storageKey, teacherNotes, updatedAt]);

  useEffect(() => {
    refreshQueueState();
  }, [syncQueueKey]);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal) {
      return;
    }

    let active = true;

    const loadCloudState = async () => {
      setCloudStatus("syncing");

      try {
        const response = await fetch(
          `/api/planning/checklist?subjectId=${encodeURIComponent(subjectId)}&areaId=${encodeURIComponent(area.id)}`,
          { method: "GET", cache: "no-store" },
        );

        if (!response.ok) {
          setCloudStatus("error");
          return;
        }

        const payload = (await response.json()) as {
          state: {
            progressMap: ChecklistProgressMap;
            teacherNotes: string;
            updatedAt: string;
          } | null;
        };

        if (!active || !payload.state) {
          setCloudStatus("synced");
          setLastSyncedAt(new Date().toISOString());
          appendSyncLog("Cloudsync hämtning klar.");
          return;
        }

        const localDate = updatedAt ? new Date(updatedAt).getTime() : 0;
        const cloudDate = payload.state.updatedAt ? new Date(payload.state.updatedAt).getTime() : 0;

        if (cloudDate > localDate) {
          setProgressMap({ ...getDefaultStatusMap(area), ...payload.state.progressMap });
          setTeacherNotes(payload.state.teacherNotes);
          setUpdatedAt(payload.state.updatedAt);
        }

        setCloudStatus("synced");
        setLastSyncedAt(new Date().toISOString());
        appendSyncLog("Cloudsync hämtning klar.");
      } catch {
        if (active) {
          setCloudStatus("error");
          appendSyncLog("Cloudsync hämtning misslyckades.");
        }
      }
    };

    void loadCloudState();

    return () => {
      active = false;
    };
  }, [area, cloudSyncEnabled, hasHydratedLocal, subjectId, updatedAt]);

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
  }, [cloudSyncEnabled, hasHydratedLocal]);

  useEffect(() => {
    if (!cloudSyncEnabled || !hasHydratedLocal) {
      return;
    }

    const nextUpdatedAt = new Date().toISOString();
    const timer = window.setTimeout(async () => {
      setCloudStatus("syncing");

      try {
        const response = await fetch("/api/planning/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            areaId: area.id,
            progressMap,
            subjectId,
            teacherNotes,
            updatedAt: nextUpdatedAt,
          }),
        });

        if (response.status === 409) {
          const payload = (await response.json()) as {
            state?: {
              progressMap: ChecklistProgressMap;
              teacherNotes: string;
              updatedAt: string;
            };
            mergedState?: {
              progressMap: ChecklistProgressMap;
              teacherNotes: string;
              updatedAt: string;
            };
          };

          if (payload.state) {
            setPendingConflict({
              localState: {
                progressMap: { ...progressMap },
                teacherNotes,
                updatedAt: nextUpdatedAt,
              },
              mergedState: payload.mergedState,
              serverState: payload.state,
            });
          }

          setCloudStatus("conflict");
          appendSyncLog("Konflikt upptäckt. Väntar på val i konfliktöversikten.");
          return;
        }

        if (!response.ok) {
          setCloudStatus("error");
          appendSyncLog("Cloudsync sparning misslyckades.");
          enqueueSyncPayload({
            areaId: area.id,
            progressMap,
            subjectId,
            teacherNotes,
            updatedAt: nextUpdatedAt,
          });
          appendSyncLog("Lagt i synkkö för senare försök.");
          return;
        }

        setUpdatedAt(nextUpdatedAt);
        setCloudStatus("synced");
        setLastSyncedAt(nextUpdatedAt);
        appendSyncLog("Cloudsync sparning klar.");
      } catch {
        setCloudStatus("error");
        appendSyncLog("Cloudsync sparning misslyckades.");
        enqueueSyncPayload({
          areaId: area.id,
          progressMap,
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
  }, [area, cloudRetryToken, cloudSyncEnabled, hasHydratedLocal, progressMap, subjectId, teacherNotes]);

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
    setCloudRetryToken((current) => current + 1);
    appendSyncLog("Manuell sync-retry startad.");
    void flushCloudQueue();
  };

  const resolveConflict = (strategy: "server" | "merged" | "local") => {
    if (!pendingConflict) {
      return;
    }

    const target =
      strategy === "server"
        ? pendingConflict.serverState
        : strategy === "merged" && pendingConflict.mergedState
          ? pendingConflict.mergedState
          : pendingConflict.localState;

    setProgressMap({
      ...getDefaultStatusMap(area),
      ...target.progressMap,
    });
    setTeacherNotes(target.teacherNotes);
    setUpdatedAt(strategy === "local" ? new Date().toISOString() : target.updatedAt);
    setPendingConflict(null);
    setCloudStatus("idle");
    setCloudRetryToken((current) => current + 1);
    appendSyncLog(`Konflikt löst via strategi: ${strategy}.`);
  };

  return {
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
    setTeacherNotes: updateTeacherNotes,
    syncLog,
    teacherNotes,
  };
}
