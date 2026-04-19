import Link from "next/link";
import { redirect } from "next/navigation";
import { updateSettingsAction } from "@/app/(dashboard)/installningar/actions";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getNoticeFromSearchParams,
  type AuthSearchParams,
} from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { parseUserSettings } from "@/lib/validations/user-settings";

const SCHOOL_LEVEL_OPTIONS = [
  {
    value: "",
    label: "Standard",
    description: "Ingen särskild årskursanpassning. Används om du jobbar brett eller vill hålla tonen neutral.",
  },
  {
    value: "F-3",
    label: "F-3",
    description: "Mer konkret och lättillgängligt språk för yngre elever och vårdnadshavare.",
  },
  {
    value: "4-6",
    label: "4-6",
    description: "Balans mellan tydlighet, ämnesspråk och tydliga nästa steg.",
  },
  {
    value: "7-9",
    label: "7-9",
    description: "Något mer analytiskt och ämnesspecifikt språk för högstadiets dokumentation.",
  },
] as const;

const TONE_OPTIONS = [
  {
    value: "",
    label: "Standard",
    description: "Skolskribentens vanliga ton, utan extra styrning.",
  },
  {
    value: "formal",
    label: "Formell",
    description: "Sakligt, kortfattat och nära myndighetssvenska.",
  },
  {
    value: "warm",
    label: "Varm",
    description: "Fortfarande professionellt, men något mjukare och mer stödjande där det passar.",
  },
] as const;

const SCHOOL_LEVEL_LABELS = {
  "F-3": "F-3",
  "4-6": "4-6",
  "7-9": "7-9",
} as const;

const TONE_LABELS = {
  formal: "Formell",
  warm: "Varm",
} as const;

interface Props {
  searchParams?: AuthSearchParams;
}

export default async function InstallningarPage({ searchParams }: Props): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/logga-in?next=%2Finstallningar");
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div className="ss-card w-full p-8">
          <h1 className="text-3xl font-semibold tracking-tight">Profil hittades inte</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Vi kunde inte läsa in ditt konto ännu. Kontrollera att Supabase-migreringarna är körda
            och att profilen finns i tabellen <code>profiles</code>.
          </p>
        </div>
      </main>
    );
  }

  const notice = getNoticeFromSearchParams(searchParams);
  const userSettings = parseUserSettings(profile.user_settings);
  const schoolLevelValue = userSettings.schoolLevel ?? "";
  const preferredToneValue = userSettings.preferredTone ?? "";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="ss-card p-8">
          <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Inställningar</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
            Gör skrivstationen mer träffsäker
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            Här styr du hur Skolskribenten formulerar utkasten för just ditt arbete. Vi sparar bara
            kontoinställningar som namn, skola och skrivpreferenser, aldrig rå elevdokumentation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/skrivstation">Till skrivstationen</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/konto">Konto</Link>
            </Button>
            <SignOutButton className="rounded-full" />
          </div>

          {notice ? (
            <div className="mt-6">
              <AuthNotice type={notice.type} message={notice.message} />
            </div>
          ) : null}

          <form action={updateSettingsAction} className="mt-8 space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-[var(--ss-neutral-900)]">
                  Namn
                </label>
                <Input
                  id="fullName"
                  name="fullName"
                  defaultValue={profile.full_name ?? ""}
                  autoComplete="name"
                  required
                  className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="schoolName"
                  className="text-sm font-medium text-[var(--ss-neutral-900)]"
                >
                  Skola eller arbetsplats
                </label>
                <Input
                  id="schoolName"
                  name="schoolName"
                  defaultValue={profile.school_name ?? ""}
                  autoComplete="organization"
                  placeholder="Valfritt"
                  className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
                />
              </div>
            </div>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-[var(--ss-neutral-900)]">
                Skolnivå för dina utkast
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                {SCHOOL_LEVEL_OPTIONS.map((option) => {
                  const isActive = schoolLevelValue === option.value;

                  return (
                    <label
                      key={option.label}
                      className={cn(
                        "cursor-pointer rounded-[1.5rem] border px-5 py-4 transition-colors",
                        isActive
                          ? "border-[var(--ss-primary)] bg-[var(--ss-primary-light)]"
                          : "border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] hover:bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="schoolLevel"
                        value={option.value}
                        defaultChecked={isActive}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-[var(--ss-neutral-900)]">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-sm font-medium text-[var(--ss-neutral-900)]">
                Föredragen ton
              </legend>
              <div className="grid gap-3 md:grid-cols-3">
                {TONE_OPTIONS.map((option) => {
                  const isActive = preferredToneValue === option.value;

                  return (
                    <label
                      key={option.label}
                      className={cn(
                        "cursor-pointer rounded-[1.5rem] border px-5 py-4 transition-colors",
                        isActive
                          ? "border-[var(--ss-secondary)] bg-[var(--ss-secondary-light)]"
                          : "border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] hover:bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="preferredTone"
                        value={option.value}
                        defaultChecked={isActive}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-[var(--ss-neutral-900)]">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-[1.5rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-5 text-sm leading-7 text-[var(--ss-neutral-800)]">
              De här inställningarna påverkar bara formulering, tydlighetsnivå och ton i AI-utkasten.
              Själva anteckningarna scrubbas fortfarande i webbläsaren innan något skickas vidare.
            </div>

            <AuthSubmitButton
              type="submit"
              idleLabel="Spara inställningar"
              pendingLabel="Sparar..."
              className="h-12 rounded-full px-6"
            />
          </form>
        </section>

        <aside className="space-y-6">
          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">Aktivt nu</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Namn</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {profile.full_name ?? "Ej angivet"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">E-post</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {user.email ?? profile.email}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Skola</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {profile.school_name ?? "Ej angivet"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Skolnivå</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {userSettings.schoolLevel ? SCHOOL_LEVEL_LABELS[userSettings.schoolLevel] : "Standard"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ton</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {userSettings.preferredTone ? TONE_LABELS[userSettings.preferredTone] : "Standard"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">
              Så används valen
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--ss-neutral-800)]">
              <p>
                Skolnivån påverkar hur konkret eller analytiskt texten skrivs, så att utkasten känns
                rimliga för din vardag.
              </p>
              <p>
                Tonvalet styr hur formell eller varm formuleringen blir, utan att tumma på
                professionalitet eller saklighet.
              </p>
              <p>
                Inställningarna sparas i din profil och används nästa gång du genererar text i
                skrivstationen.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
