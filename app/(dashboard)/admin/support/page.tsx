import type { Metadata } from "next";
import Link from "next/link";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import {
  assignSupportRequestToMeAction,
  deleteSupportRequestAction,
  redactSupportRequestAction,
  updateSupportRequestStatusAction,
} from "@/app/(dashboard)/admin/support/actions";
import {
  SUPPORT_REQUEST_STATUSES,
  SUPPORT_REQUEST_STATUS_LABELS,
  SUPPORT_STATUS_FILTERS,
  getSupportStatusFilterStatuses,
  parseSupportStatusFilter,
  type SupportStatusFilter,
} from "@/lib/support/admin";
import { getSupportAdminContext } from "@/lib/support/admin-server";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "Supportadmin",
  description: "Triagera, redigera och stäng supportärenden.",
};

type SupportRequestRow = Database["public"]["Tables"]["support_requests"]["Row"];

interface Props {
  searchParams?: {
    error?: string | string[];
    status?: string | string[];
    success?: string | string[];
  };
}

function getFirstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getStatusFilterLabel(filter: SupportStatusFilter): string {
  if (filter === "open") {
    return "Öppna";
  }

  if (filter === "all") {
    return "Alla";
  }

  return SUPPORT_REQUEST_STATUS_LABELS[filter];
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Ej satt";
  }

  return new Date(value).toLocaleString("sv-SE");
}

async function loadSupportRequests(
  context: NonNullable<Awaited<ReturnType<typeof getSupportAdminContext>>>,
  filter: SupportStatusFilter,
): Promise<{
  error: string | null;
  requests: SupportRequestRow[];
}> {
  const statuses = getSupportStatusFilterStatuses(filter);
  let query = context.adminSupabase
    .from("support_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (statuses) {
    query = query.in("status", statuses);
  }

  const { data, error } = await query;

  if (error) {
    return {
      error: "Kunde inte läsa supportkön just nu.",
      requests: [],
    };
  }

  return {
    error: null,
    requests: data ?? [],
  };
}

export default async function SupportAdminPage({ searchParams }: Props): Promise<JSX.Element> {
  const statusFilter = parseSupportStatusFilter(getFirstSearchParam(searchParams?.status));
  const successMessage = getFirstSearchParam(searchParams?.success);
  const errorMessage = getFirstSearchParam(searchParams?.error);
  const context = await getSupportAdminContext("/admin/support");

  if (!context) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-4xl px-6 py-16 lg:px-8">
        <section className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Supportadmin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
            Behörighet krävs
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Den här ytan är bara för konton som finns i den serverstyrda adminlistan. Be en
            befintlig administratör lägga till ditt användar-ID i `app_admins`.
          </p>
        </section>
      </main>
    );
  }

  const { error: loadError, requests } = await loadSupportRequests(context, statusFilter);

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-12 lg:px-8">
      <section className="ss-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Supportadmin</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
              Supportinkorg
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Triagera med minsta möjliga åtkomst. Redigera bort elevuppgifter direkt, håll ärenden
              kopplade till request-ID och använd inte supportkön som kunskapsdatabas.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/admin/support?status=open">Öppna ärenden</Link>
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {SUPPORT_STATUS_FILTERS.map((filter) => (
            <Button
              key={filter}
              asChild
              size="sm"
              variant={statusFilter === filter ? "default" : "outline"}
              className="rounded-full"
            >
              <Link href={`/admin/support?status=${filter}`}>{getStatusFilterLabel(filter)}</Link>
            </Button>
          ))}
        </div>

        {successMessage ? (
          <div className="mt-6">
            <AuthNotice type="success" message={successMessage} />
          </div>
        ) : null}
        {errorMessage ?? loadError ? (
          <div className="mt-6">
            <AuthNotice type="error" message={errorMessage ?? loadError ?? "Något gick fel."} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {requests.length === 0 ? (
            <p className="rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-5 text-sm text-muted-foreground">
              Inga supportärenden matchar filtret.
            </p>
          ) : (
            requests.map((request) => (
              <SupportRequestCard
                key={request.id}
                currentAdminUserId={context.user.id}
                request={request}
                statusFilter={statusFilter}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function SupportRequestCard({
  currentAdminUserId,
  request,
  statusFilter,
}: {
  currentAdminUserId: string;
  request: SupportRequestRow;
  statusFilter: SupportStatusFilter;
}): JSX.Element {
  const isRedacted = request.status === "redacted" || request.status === "deleted";

  return (
    <article className="rounded-2xl border border-[var(--ss-neutral-200)] bg-white p-5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--ss-primary-light)] px-3 py-1 text-xs font-semibold text-[var(--ss-primary-dark)]">
              {SUPPORT_REQUEST_STATUS_LABELS[request.status as keyof typeof SUPPORT_REQUEST_STATUS_LABELS] ??
                request.status}
            </span>
            <span className="rounded-full bg-[var(--ss-neutral-100)] px-3 py-1 text-xs text-[var(--ss-neutral-700)]">
              {request.topic}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-[var(--ss-neutral-900)]">
            {request.request_id ?? request.id}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Skapad: {formatDate(request.created_at)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Senaste statusändring: {formatDate(request.last_status_at)}
          </p>
        </div>

        <div className="text-right text-xs leading-6 text-muted-foreground">
          <p>Tilldelad: {request.assigned_to ?? "Ingen"}</p>
          <p>Du: {currentAdminUserId}</p>
          <p>Användare: {request.user_id ?? "Ej inloggad"}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-xl border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-4 md:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Namn</dt>
          <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">{request.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">E-post</dt>
          <dd className="mt-1 break-all font-medium text-[var(--ss-neutral-900)]">{request.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Roll</dt>
          <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">{request.role ?? "Ej angiven"}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-[var(--ss-neutral-100)] bg-white p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Meddelande</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--ss-neutral-900)]">
          {request.message}
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <form action={updateSupportRequestStatusAction} className="rounded-xl border border-[var(--ss-neutral-100)] p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="statusFilter" value={statusFilter} />
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Status
            <select
              name="status"
              defaultValue={request.status}
              className="mt-2 h-10 w-full rounded-xl border border-[var(--ss-neutral-200)] bg-white px-3 text-sm normal-case tracking-normal"
            >
              {SUPPORT_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SUPPORT_REQUEST_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm" className="mt-3 rounded-full">
            Uppdatera status
          </Button>
        </form>

        <form action={assignSupportRequestToMeAction} className="rounded-xl border border-[var(--ss-neutral-100)] p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="statusFilter" value={statusFilter} />
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Tilldelning</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tilldela ärendet till ditt admin-ID och markera det som triagerat.
          </p>
          <Button type="submit" size="sm" variant="outline" className="mt-3 rounded-full">
            Tilldela mig
          </Button>
        </form>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <form action={redactSupportRequestAction} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="statusFilter" value={statusFilter} />
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-amber-900">Redigera bort innehåll</p>
          <label className="mt-3 flex gap-2 text-sm leading-6 text-amber-950">
            <input type="checkbox" name="confirmed" value="yes" required disabled={isRedacted} />
            Jag förstår att namn, e-post, roll och meddelande ersätts med platshållare.
          </label>
          <Button type="submit" size="sm" variant="outline" className="mt-3 rounded-full" disabled={isRedacted}>
            Redigera ärende
          </Button>
        </form>

        <form action={deleteSupportRequestAction} className="rounded-xl border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="statusFilter" value={statusFilter} />
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-900">Radera mjukt</p>
          <label className="mt-3 flex gap-2 text-sm leading-6 text-red-950">
            <input type="checkbox" name="confirmed" value="yes" required disabled={request.status === "deleted"} />
            Jag förstår att ärendet markeras raderat och innehållet tas bort från supportkön.
          </label>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="mt-3 rounded-full"
            disabled={request.status === "deleted"}
          >
            Radera ärende
          </Button>
        </form>
      </div>

      <div className="mt-4 grid gap-2 text-xs leading-6 text-muted-foreground md:grid-cols-3">
        <p>Hanterad: {formatDate(request.handled_at)}</p>
        <p>Redigerad: {formatDate(request.redacted_at)}</p>
        <p>Raderad: {formatDate(request.deleted_at)}</p>
      </div>
    </article>
  );
}
