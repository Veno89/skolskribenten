import type { Metadata } from "next";
import Link from "next/link";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import {
  formatGuardPassRate,
  summarizeAiGovernanceEvents,
  type AiUsageEventRow,
} from "@/lib/ai/admin";
import { getAppAdminContext } from "@/lib/admin/server";

export const metadata: Metadata = {
  title: "AI-styrning",
  description: "Adminvy för AI-versioner, output guard och varningssignaler.",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Ej mätt";
  }

  return new Date(value).toLocaleString("sv-SE");
}

async function loadAiGovernanceData(
  context: NonNullable<Awaited<ReturnType<typeof getAppAdminContext>>>,
): Promise<{
  error: string | null;
  events: AiUsageEventRow[];
}> {
  const { data, error } = await context.adminSupabase
    .from("usage_events")
    .select(
      "ai_model,ai_provider,created_at,output_guard_passed,output_guard_version,output_guard_warnings,prompt_version,template_type",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return {
    error: error ? "Kunde inte läsa AI-styrningens driftdata just nu." : null,
    events: (data ?? []) as AiUsageEventRow[],
  };
}

export default async function AiGovernanceAdminPage(): Promise<JSX.Element> {
  const context = await getAppAdminContext("/admin/ai-governance");

  if (!context) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-4xl px-6 py-16 lg:px-8">
        <section className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">AI-styrning</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
            Behörighet krävs
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Den här ytan är bara för konton som finns i den serverstyrda adminlistan.
          </p>
        </section>
      </main>
    );
  }

  const { error, events } = await loadAiGovernanceData(context);
  const stats = summarizeAiGovernanceEvents(events);
  const recentEvents = events.slice(0, 30);

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Admin</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
              AI-styrning
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Driftvy för promptversioner, modellversioner och output guard. Rå prompttext,
              genererad text och läraranteckningar visas inte här.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/support">Support</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/planning-sync">Sync</Link>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6">
            <AuthNotice type="error" message={error} />
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <StatCard label="AI-händelser" value={stats.eventCount.toString()} />
          <StatCard label="Pass rate" value={formatGuardPassRate(stats)} />
          <StatCard label="Blockerade" value={stats.blockedCount.toString()} />
          <StatCard label="Varningar" value={stats.warningCount.toString()} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Senaste AI-händelse: {formatDate(stats.latestEventAt)}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--ss-neutral-900)]">Versioner</h2>
        <div className="mt-4 grid gap-4">
          {stats.versionRows.length === 0 ? (
            <p className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm text-muted-foreground">
              Inga AI-händelser finns ännu.
            </p>
          ) : (
            stats.versionRows.map((row) => (
              <article
                key={`${row.promptVersion}:${row.outputGuardVersion}:${row.aiModel}`}
                className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricBlock label="Prompt" value={row.promptVersion} />
                  <MetricBlock label="Output guard" value={row.outputGuardVersion} />
                  <MetricBlock label="Modell" value={row.aiModel} />
                  <MetricBlock
                    label="Signal"
                    value={`${row.eventCount} händelser, ${row.blockedCount} blockerade, ${row.warningCount} varningar`}
                  />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-[var(--ss-neutral-900)]">Senaste händelser</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--ss-neutral-200)] bg-white">
          {recentEvents.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Inga händelser att visa.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--ss-neutral-200)] text-left text-sm">
                <thead className="bg-[var(--ss-neutral-50)] text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tid</th>
                    <th className="px-4 py-3 font-medium">Mall</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Version</th>
                    <th className="px-4 py-3 font-medium">Varningar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ss-neutral-100)]">
                  {recentEvents.map((event, index) => (
                    <tr key={`${event.created_at}:${event.template_type}:${index}`}>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {formatDate(event.created_at)}
                      </td>
                      <td className="px-4 py-3 align-top">{event.template_type}</td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={
                            event.output_guard_passed
                              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-800"
                          }
                        >
                          {event.output_guard_passed ? "Passerade" : "Blockerad"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {event.prompt_version}
                        <br />
                        {event.output_guard_version}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {event.output_guard_warnings.length === 0
                          ? "Inga"
                          : event.output_guard_warnings.join("; ")}
                      </td>
                    </tr>
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

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ss-neutral-900)]">{value}</p>
    </div>
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
