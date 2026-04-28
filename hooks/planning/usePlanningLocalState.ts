import { useCallback, useEffect, useState } from "react";
import {
  getPlanningStorageKey,
  parseStoredChecklist,
  serializeChecklistState,
} from "@/lib/planning/checklist-storage";
import type { PlanningArea, PlanningSubjectId } from "@/lib/planning/curriculum";
import {
  getDefaultStatusMap,
  type ChecklistProgressMap,
  type ChecklistStatus,
} from "@/lib/planning/gap-analysis";
import {
  isPlanningScopeMatch,
  type PlanningScope,
  type PlanningStoredState,
} from "@/hooks/planning/types";

interface Params {
  area: PlanningArea;
  currentScope: PlanningScope;
  subjectId: PlanningSubjectId;
  userId: string;
}

export function usePlanningLocalState({
  area,
  currentScope,
  subjectId,
  userId,
}: Params) {
  const [progressMap, setProgressMap] = useState<ChecklistProgressMap>(() => getDefaultStatusMap(area));
  const [teacherNotes, setTeacherNotes] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [cloudRevision, setCloudRevision] = useState<number | null>(null);
  const [hasHydratedLocal, setHasHydratedLocal] = useState(false);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const storageKey = getPlanningStorageKey(userId, subjectId, area.id);

  const hydrateChecklistFromStorage = useCallback(() => {
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
      setHydratedStorageKey(storageKey);
      return;
    }

    setProgressMap({ ...defaults, ...stored.progressMap });
    setCloudRevision(stored.revision ?? null);
    setTeacherNotes(stored.teacherNotes);
    setUpdatedAt(stored.updatedAt);
    setHasHydratedLocal(true);
    setHydratedStorageKey(storageKey);
  }, [area, storageKey]);

  const writeStoredChecklistState = useCallback((
    target: PlanningScope,
    state: PlanningStoredState,
  ) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getPlanningStorageKey(userId, target.subjectId as PlanningSubjectId, target.areaId),
      serializeChecklistState(state),
    );
  }, [userId]);

  const applyStateToActiveArea = useCallback((
    target: PlanningScope,
    state: PlanningStoredState,
  ) => {
    if (!isPlanningScopeMatch(target, currentScope)) {
      return;
    }

    setProgressMap({ ...getDefaultStatusMap(area), ...state.progressMap });
    setCloudRevision(state.revision ?? null);
    setTeacherNotes(state.teacherNotes);
    setUpdatedAt(state.updatedAt);
  }, [area, currentScope]);

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

  useEffect(() => {
    hydrateChecklistFromStorage();
  }, [hydrateChecklistFromStorage]);

  useEffect(() => {
    if (!hasHydratedLocal || hydratedStorageKey !== storageKey || typeof window === "undefined") {
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
  }, [cloudRevision, hasHydratedLocal, hydratedStorageKey, progressMap, storageKey, teacherNotes, updatedAt]);

  return {
    applyStateToActiveArea,
    cloudRevision,
    hasHydratedLocal,
    hydrateChecklistFromStorage,
    progressMap,
    resetChecklist,
    setCloudRevision,
    setItemStatus,
    setProgressMap,
    setTeacherNotes,
    setUpdatedAt,
    storageKey,
    teacherNotes,
    updatedAt,
    updateTeacherNotes,
    writeStoredChecklistState,
  };
}
