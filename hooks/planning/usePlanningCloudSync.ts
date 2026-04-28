import { useCallback, useRef, useState } from "react";
import type { CloudStatus } from "@/hooks/usePlanningChecklist";
import type { PlanningSyncConflictState } from "@/lib/planning/sync-queue";

export function usePlanningCloudSync() {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  const [pendingConflict, setPendingConflict] = useState<PlanningSyncConflictState | null>(null);
  const isFlushingQueueRef = useRef(false);

  const appendSyncLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSyncLog((current) => [`${timestamp} - ${message}`, ...current].slice(0, 6));
  }, []);

  return {
    appendSyncLog,
    cloudStatus,
    isFlushingQueueRef,
    lastSyncedAt,
    pendingConflict,
    setCloudStatus,
    setLastSyncedAt,
    setPendingConflict,
    syncLog,
  };
}
