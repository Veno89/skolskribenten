import { Button } from "@/components/ui/button";
import type { CloudStatus } from "@/hooks/usePlanningChecklist";
import type {
  PlanningSyncConflictState,
  PlanningSyncQueueItem,
} from "@/lib/planning/sync-queue";

interface Props {
  cloudStatus: CloudStatus;
  cloudSyncEnabled: boolean;
  discardQueuedItem: (target: { areaId: string; subjectId: string }) => void;
  flushCloudQueue: () => void;
  lastSyncedAt: string | null;
  pendingConflict: PlanningSyncConflictState | null;
  queuedItems: PlanningSyncQueueItem[];
  queuedSyncCount: number;
  resolveConflict: (strategy: "server" | "merged" | "local") => void;
  resolveQueuedConflict: (
    target: { areaId: string; subjectId: string },
    strategy: "server" | "merged" | "local",
  ) => void;
  retryCloudSync: () => void;
  retryQueuedItem: (target: { areaId: string; subjectId: string }) => void;
  syncLog: string[];
}

export function PlanningCloudSyncPanel({
  cloudStatus,
  cloudSyncEnabled,
  discardQueuedItem,
  flushCloudQueue,
  lastSyncedAt,
  pendingConflict,
  queuedItems,
  queuedSyncCount,
  resolveConflict,
  resolveQueuedConflict,
  retryCloudSync,
  retryQueuedItem,
  syncLog,
}: Props): JSX.Element {
  return (
    <>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        {cloudSyncEnabled
          ? `Cloudsync: ${getCloudStatusLabel(cloudStatus)}`
          : "Cloudsync: lokalt läge (Pro krävs för synk mellan enheter)."}
      </p>

      {cloudStatus === "conflict" ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
        <div className="mt-2 rounded-lg border border-[var(--ss-neutral-200)] bg-[var(--ss-neutral-50)] px-3 py-2 text-xs text-muted-foreground">
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
            <QueuePanel
              discardQueuedItem={discardQueuedItem}
              flushCloudQueue={flushCloudQueue}
              queuedItems={queuedItems}
              resolveQueuedConflict={resolveQueuedConflict}
              retryQueuedItem={retryQueuedItem}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function getCloudStatusLabel(status: CloudStatus): string {
  if (status === "syncing") {
    return "synkar...";
  }

  if (status === "synced") {
    return "aktiv";
  }

  if (status === "error") {
    return "fel vid synk";
  }

  if (status === "conflict") {
    return "ditt val behövs";
  }

  return "redo";
}

function QueuePanel({
  discardQueuedItem,
  flushCloudQueue,
  queuedItems,
  resolveQueuedConflict,
  retryQueuedItem,
}: Pick<
  Props,
  "discardQueuedItem" | "flushCloudQueue" | "queuedItems" | "resolveQueuedConflict" | "retryQueuedItem"
>): JSX.Element {
  return (
    <div className="mt-2">
      <Button type="button" size="sm" variant="outline" onClick={flushCloudQueue}>
        Synka kö nu
      </Button>
      <ul className="mt-2 space-y-2">
        {queuedItems.map((item) => (
          <li
            key={`${item.subjectId}-${item.areaId}-${item.enqueuedAt}`}
            className="rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-[var(--ss-neutral-900)]">
                  {item.subjectId}/{item.areaId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Köad {new Date(item.enqueuedAt).toLocaleString("sv-SE")}
                </p>
              </div>
              <QueueStatusBadge status={item.status} />
            </div>

            {item.lastError ? (
              <p className="mt-2 text-xs leading-5 text-rose-700">{item.lastError}</p>
            ) : null}

            {item.lastAttemptAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Senaste försök: {new Date(item.lastAttemptAt).toLocaleString("sv-SE")} · Försök:{" "}
                {item.retryCount}
              </p>
            ) : null}

            <QueueActions
              discardQueuedItem={discardQueuedItem}
              item={item}
              resolveQueuedConflict={resolveQueuedConflict}
              retryQueuedItem={retryQueuedItem}
            />
            {item.status === "conflict" ? (
              <p className="mt-2 text-xs leading-5 text-amber-900">
                Molnets version använder det som redan är sparat. Din version skickar om det du har här.
                Det kombinerade förslaget försöker behålla båda, men bör granskas.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QueueActions({
  discardQueuedItem,
  item,
  resolveQueuedConflict,
  retryQueuedItem,
}: {
  discardQueuedItem: Props["discardQueuedItem"];
  item: PlanningSyncQueueItem;
  resolveQueuedConflict: Props["resolveQueuedConflict"];
  retryQueuedItem: Props["retryQueuedItem"];
}): JSX.Element {
  const target = { areaId: item.areaId, subjectId: item.subjectId };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {item.status === "conflict" ? (
        <>
          <Button type="button" size="sm" variant="outline" onClick={() => resolveQueuedConflict(target, "server")}>
            Molnets version
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => resolveQueuedConflict(target, "merged")}>
            Kombinerat förslag
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => resolveQueuedConflict(target, "local")}>
            Din version
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => retryQueuedItem(target)}>
          Försök igen
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => discardQueuedItem(target)}>
        Ta bort
      </Button>
    </div>
  );
}

function ConflictCard({ notes, title }: { notes: string; title: string }): JSX.Element {
  return (
    <article className="rounded-lg border border-amber-200 bg-white p-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">{title}</p>
      <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-amber-900">
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

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}
