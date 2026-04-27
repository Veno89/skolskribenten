import type { Metadata } from "next";
import Link from "next/link";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { Button } from "@/components/ui/button";
import { getAppAdminContext } from "@/lib/admin/server";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "Kontobegäranden",
  description: "Adminvy för kontoradering och datarättigheter.",
};

type AccountDeletionRequest =
  Database["public"]["Tables"]["account_deletion_requests"]["Row"];

function formatDate(value: string | null): string {
  if (!value) {
    return "Ej satt";
  }

  return new Date(value).toLocaleString("sv-SE");
}

async function loadAccountRequests(
  context: NonNullable<Awaited<ReturnType<typeof getAppAdminContext>>>,
): Promise<{
  error: string | null;
  requests: AccountDeletionRequest[];
}> {
  const { data, error } = await context.adminSupabase
    .from("account_deletion_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(100);

  return {
    error: error ? "Kunde inte läsa kontobegäranden just nu." : null,
    requests: data ?? [],
  };
}

export default async function AccountRequestsAdminPage(): Promise<JSX.Element> {
  const context = await getAppAdminContext("/admin/account-requests");

  if (!context) {
    return (
      <main id="main-content" className="mx-auto min-h-screen max-w-4xl px-6 py-16 lg:px-8">
        <section className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Konton</p>
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

  const { error, requests } = await loadAccountRequests(context);

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Admin</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
              Kontobegäranden
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Driftvy för kontoradering och datarättigheter. Kommentarer kan innehålla känslig
              fritext och ska inte kopieras till externa verktyg.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/support">Support</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/admin/ai-governance">AI</Link>
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6">
            <AuthNotice type="error" message={error} />
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-4">
        {requests.length === 0 ? (
          <p className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm text-muted-foreground">
            Inga kontobegäranden finns ännu.
          </p>
        ) : (
          requests.map((request) => (
            <article
              key={request.id}
              className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-5 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                    {request.status}
                  </span>
                  <h2 className="mt-3 font-semibold text-[var(--ss-neutral-900)]">{request.id}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Användare: {request.user_id}</p>
                </div>
                <div className="text-right text-xs leading-6 text-muted-foreground">
                  <p>Begärd: {formatDate(request.requested_at)}</p>
                  <p>Uppdaterad: {formatDate(request.updated_at)}</p>
                  <p>Hanterad: {formatDate(request.handled_at)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Användarkommentar
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-[var(--ss-neutral-900)]">
                  {request.reason || "Ingen kommentar angiven."}
                </p>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
