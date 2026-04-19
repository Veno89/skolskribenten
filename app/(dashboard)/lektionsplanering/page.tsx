

export const metadata: Metadata = {
  title: "Lektionsplanering",
  description: "Kommande Pro-modul för att planera lektioner med AI-stöd.",
};
import type { Metadata } from "next";
import { isActivePro } from "@/lib/billing/entitlements";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export default async function LektionsplaneringPage(): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/lektionsplanering" });
  const isPro = isActivePro(profile!);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 lg:px-8">
      <section className="ss-card p-8 md:p-10">
        <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">
          Under konstruktion
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
          Lektionsplanering kommer som nästa Pro-modul
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          Här bygger vi nästa arbetsyta: stöd för att planera lektioner med tydligt syfte, upplägg,
          differentiering och nästa steg. Vi håller den avgränsad så att den blir användbar på
          riktigt, inte bara ännu en generisk AI-ruta.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <article className="rounded-[1.5rem] bg-[var(--ss-primary-light)] p-6">
            <p className="text-sm font-semibold text-[var(--ss-primary-dark)]">Det här planerar vi</p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ss-neutral-900)]">
              <li>Tydlig lektionsstruktur med mål, innehåll, aktiviteter och avslut.</li>
              <li>Stöd för anpassningar, variation och praktiska förberedelser.</li>
              <li>Ett resultat som går att använda direkt som lektionsutkast.</li>
            </ul>
          </article>

          <article className="rounded-[1.5rem] bg-[var(--ss-neutral-50)] p-6">
            <p className="text-sm font-semibold text-[var(--ss-neutral-900)]">
              {isPro ? "Du ligger först i kön" : "Kommer för Pro"}
            </p>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {isPro
                ? "Eftersom du har Pro kommer du att ligga bra till för att testa modulen när den öppnas."
                : "Modulen lanseras först för Pro-konton. När den är redo hittar du uppgraderingen på Kontosidan."}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
