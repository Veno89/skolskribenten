import type { Metadata } from "next";
import Link from "next/link";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { getAppAdminContext } from "@/lib/admin/server";
import {
  PLANNING_SYNC_CONFLICT_FILTERS,
  abbreviateHash,
  formatProgressSummary,
  getPlanningSyncConflictFilterLabel,
  isPlanningClientClockAhead,
  isPlanningSyncConflictResolved,
  parsePlanningSyncConflictFilter,
  summarizeProgressMap,
  type PlanningSyncConflictFilter,
} from "@/lib/planning/admin";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "Planeringssync",
  description: "Adminvy för planeringssync, konflikter och driftindikatorer.",
};

type PlanningSyncConflictRow = Database["public"]["Tables"]["planning_sync_conflicts"]["Row"];
type PlanningChecklistRow = Pick<
  Database["public"]["Tables"]["planning_checklists"]["Row"],
  | "area_id"
  | "client_updated_at"
  | "created_at"
  | "id"
  | "progress_map"
  | "revision"
  | "subject_id"
  | "updated_at"
  | "user_id"
>;

interface Props {
  searchParams?: {
    filter?: string | string[];
  };
}

function getFirstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Ej satt";
  }

  return new Date(value).toLocaleString("sv-SE");
}

async function loadPlanningSyncDebugData(
  context: NonNullable<Awaited<ReturnType<typeof getAppAdminContext>>>,
  filter: PlanningSyncConflictFilter,
): Promise<{
  checklistRows: PlanningChecklistRow[];
  conflicts: PlanningSyncConflictRow[];
  error: string | null;
  stats: {
    checklistCount: number;
    conflictsLast24h: number;
    resolvedConflictCount: number;
    unresolvedConflictCount: number;
  };
}> {
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  let conflictQuery = context.adminSupabase
    .from("planning_sync_conflicts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (filter === "unresolved") {
    conflictQuery = conflictQuery.is("resolved_at", null);
  } else if (filter === "resolved") {
    conflictQuery = conflictQuery.not("resolved_at", "is", null);
  }

  const [
    conflictResult,
    checklistResult,
    unresolvedResult,
    resolvedResult,
    recentResult,
    checklistCountResult,
  ] = await Promise.all([
    conflictQuery,
    context.adminSupabase
      .from("planning_checklists")
      .select("id,user_id,subject_id,area_id,progress_map,revision,created_at,updated_at,client_updated_at")
      .order("updated_at", { ascending: false })
      .limit(50),
    context.adminSupabase
      .from("planning_sync_conflicts")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
    context.adminSupabase
      .from("planning_sync_conflicts")
      .select("id", { count: "exact", head: true })
      .not("resolved_at", "is", null),
    context.adminSupabase
      .from("planning_sync_conflicts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last24h),
    context.adminSupabase
      .from("planning_checklists")
      .select("id", { count: "exact", head: true }),
  ]);

  const firstError =
    conflictResult.error ??
    checklistResult.error ??
    unresolvedResult.error ??
    resolvedResult.error ??
    recentResult.error ??
    checklistCountResult.error ??
    null;

  return {
    checklistRows: (checklistResult.data ?? []) as PlanningChecklistRow[],
    conflicts: conflictResult.data ?? [],
    error: firstError ? "Kunde inte läsa planeringssyncens driftdata just nu." : null,
    stats: {
      checklistCount: checklistCountResult.count ?? 0,
      conflictsLast24h: recentResult.count ?? 0,
      resolvedConflictCount: resolvedResult.count ?? 0,
      unresolvedConflictCount: unresolvedResult.count ?? 0,
    },
  };
}

export default async function PlanningSyncAdminPage({ searchParams }: Props): Promise<JSX.Element> {
  const filter = parsePlanningSyncConflictFilter(getFirstSearchParam(searchParams?.filter));
  const context = await getAppAdminContext("/admin/planning-sync");

  if (!context) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-4xl px-6 py-16 lg:px-8">
        <section className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Planeringssync</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
            Behörighet krävs
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Den här ytan är bara för konton som finns i den serverstyrda adminlistan. Be en befintlig
            administratör lägga till ditt användar-ID i `app_admins`.
          </p>
        </section>
      </main>
    );
  }

  const { checklistRows, conflicts, error, stats } = await loadPlanningSyncDebugData(context, filter);

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Admin</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
              Planeringssync
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Driftvy för revisioner, konflikter och möjliga klockavvikelser. Råa planeringsanteckningar
              visas inte här.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/support">Support</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/planning-sync?filter=unresolved">Olösta konflikter</Link>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6">
            <AuthNotice type="error" message={error} />
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard label="Synkade rader" value={stats.checklistCount} />
          <StatCard label="Olösta konflikter" value={stats.unresolvedConflictCount} />
          <StatCard label="Lösta konflikter" value={stats.resolvedConflictCount} />
          <StatCard label="Konflikter 24h" value={stats.conflictsLast24h} />
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {PLANNING_SYNC_CONFLICT_FILTERS.map((candidate) => (
            <Button
              key={candidate}
              asChild
              size="sm"
              variant={filter === candidate ? "default" : "outline"}
              className="rounded-full"
            >
              <Link href={`/admin/planning-sync?filter=${candidate}`}>
                {getPlanningSyncConflictFilterLabel(candidate)}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--ss-neutral-900)]">Konflikter</h2>
        <div className="mt-4 grid gap-4">
          {conflicts.length === 0 ? (
            <p className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm text-muted-foreground">
              Inga konflikter matchar filtret.
            </p>
          ) : (
            conflicts.map((conflict) => <ConflictCard key={conflict.id} conflict={conflict} />)
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--ss-neutral-900)]">Senast uppdaterade sync-rader</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ss-neutral-200)] bg-white">
          {checklistRows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Inga planeringsrader finns ännu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--ss-neutral-200)] text-left text-sm">
                <thead className="bg-[var(--ss-neutral-50)] text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Användare</th>
                    <th className="px-4 py-3 font-medium">Revision</th>
                    <th className="px-4 py-3 font-medium">Server</th>
                    <th className="px-4 py-3 font-medium">Klient</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ss-neutral-100)]">
                  {checklistRows.map((row) => (
                    <ChecklistRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ss-neutral-900)]">{value}</p>
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: PlanningSyncConflictRow }): JSX.Element {
  const resolved = isPlanningSyncConflictResolved(conflict);
  const serverSummary = summarizeProgressMap(conflict.server_progress_map);
  const clientSummary = summarizeProgressMap(conflict.client_progress_map);

  return (
    <article className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                resolved
                  ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                  : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"
              }
            >
              {resolved ? "Löst" : "Olöst"}
            </span>
            <span className="rounded-full bg-[var(--ss-neutral-100)] px-3 py-1 text-xs text-[var(--ss-neutral-700)]">
              {conflict.subject_id}/{conflict.area_id}
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-[var(--ss-neutral-900)]">{conflict.id}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Skapad: {formatDate(conflict.created_at)}</p>
        </div>
        <div className="text-right text-xs leading-6 text-muted-foreground">
          <p>Användare: {conflict.user_id}</p>
          <p>Löst: {formatDate(conflict.resolved_at)}</p>
          <p>Strategi: {conflict.resolution_strategy ?? "Ej vald"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricBlock label="Revisioner" value={`server ${conflict.server_revision}, klient ${conflict.client_base_revision ?? "saknas"}`} />
        <MetricBlock label="Serverprogress" value={formatProgressSummary(serverSummary)} />
        <MetricBlock label="Klientprogress" value={formatProgressSummary(clientSummary)} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <MetricBlock
          label="Servernotering"
          value={`${conflict.server_teacher_notes_length} tecken, hash ${abbreviateHash(conflict.server_teacher_notes_hash)}`}
        />
        <MetricBlock
          label="Klientnotering"
          value={`${conflict.client_teacher_notes_length} tecken, hash ${abbreviateHash(conflict.client_teacher_notes_hash)}`}
        />
      </div>
    </article>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words font-medium text-[var(--ss-neutral-900)]">{value}</p>
    </div>
  );
}

function ChecklistRow({ row }: { row: PlanningChecklistRow }): JSX.Element {
  const progressSummary = summarizeProgressMap(row.progress_map);
  const hasClockSignal = isPlanningClientClockAhead(row);

  return (
    <tr>
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-[var(--ss-neutral-900)]">{row.subject_id}</p>
        <p className="text-xs text-muted-foreground">{row.area_id}</p>
      </td>
      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">{row.user_id}</td>
      <td className="px-4 py-3 align-top">{row.revision}</td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">{formatDate(row.updated_at)}</td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">{formatDate(row.client_updated_at)}</td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">{formatProgressSummary(progressSummary)}</td>
      <td className="px-4 py-3 align-top">
        {hasClockSignal ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Klientklocka före
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Normal
          </span>
        )}
      </td>
    </tr>
  );
}
