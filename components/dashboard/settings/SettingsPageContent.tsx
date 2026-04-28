import {
  requestAccountDeletionAction,
  updateEmailAction,
  updateSettingsAction,
} from "@/app/(dashboard)/installningar/actions";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { ClearLocalDataButton } from "@/components/dashboard/settings/ClearLocalDataButton";
import { Input } from "@/components/ui/input";
import type { AuthMessageType } from "@/lib/auth/redirects";
import { cn } from "@/lib/utils";
import {
  parseUserSettings,
  SCHOOL_LEVEL_LABELS,
  TONE_LABELS,
} from "@/lib/validations/user-settings";
import type { Profile } from "@/types";

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

interface SettingsPageContentProps {
  notice: {
    type: AuthMessageType;
    message: string;
  } | null;
  profile: Profile;
  userEmail?: string;
}

interface ChoiceOption {
  value: string;
  label: string;
  description: string;
}

function ChoiceFieldset(props: {
  activeValue: string;
  accentClassName: string;
  columnsClassName: string;
  legend: string;
  name: string;
  options: readonly ChoiceOption[];
}): JSX.Element {
  const { activeValue, accentClassName, columnsClassName, legend, name, options } = props;

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-[var(--ss-neutral-900)]">{legend}</legend>
      <div className={cn("grid gap-3", columnsClassName)}>
        {options.map((option) => {
          const isActive = activeValue === option.value;

          return (
            <label
              key={option.label}
              className={cn(
                "cursor-pointer rounded-[1.5rem] border px-5 py-4 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--ss-primary)] focus-within:ring-offset-2",
                isActive
                  ? accentClassName
                  : "border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] hover:bg-white",
              )}
            >
              <input
                type="radio"
                name={name}
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
  );
}

export function SettingsPageContent(props: SettingsPageContentProps): JSX.Element {
  const { notice, profile, userEmail } = props;
  const userSettings = parseUserSettings(profile.user_settings);
  const schoolLevelValue = userSettings.schoolLevel ?? "";
  const preferredToneValue = userSettings.preferredTone ?? "";
  const safeCapitalizedWordsValue = (userSettings.safeCapitalizedWords ?? []).join("\n");

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-16 lg:px-8">
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
                <label htmlFor="schoolName" className="text-sm font-medium text-[var(--ss-neutral-900)]">
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

            <ChoiceFieldset
              activeValue={schoolLevelValue}
              accentClassName="border-[var(--ss-primary)] bg-[var(--ss-primary-light)]"
              columnsClassName="md:grid-cols-2"
              legend="Skolnivå för dina utkast"
              name="schoolLevel"
              options={SCHOOL_LEVEL_OPTIONS}
            />

            <ChoiceFieldset
              activeValue={preferredToneValue}
              accentClassName="border-[var(--ss-secondary)] bg-[var(--ss-secondary-light)]"
              columnsClassName="md:grid-cols-3"
              legend="Föredragen ton"
              name="preferredTone"
              options={TONE_OPTIONS}
            />

            <div className="space-y-2">
              <label
                htmlFor="safeCapitalizedWords"
                className="text-sm font-medium text-[var(--ss-neutral-900)]"
              >
                Säkra versalord
              </label>
              <textarea
                id="safeCapitalizedWords"
                name="safeCapitalizedWords"
                defaultValue={safeCapitalizedWordsValue}
                rows={4}
                className="w-full rounded-2xl border border-input bg-[var(--ss-neutral-50)] px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Till exempel Skolplattformen, Teams eller skolans namn"
              />
              <p className="text-xs leading-6 text-muted-foreground">
                Ett ord per rad. De här orden flaggas inte som möjliga namn i GDPR-skölden.
              </p>
            </div>

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
                  {userEmail ?? profile.email}
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
              <div>
                <dt className="text-muted-foreground">Säkra versalord</dt>
                <dd className="mt-1 font-medium text-[var(--ss-neutral-900)]">
                  {userSettings.safeCapitalizedWords?.length
                    ? userSettings.safeCapitalizedWords.join(", ")
                    : "Inga extra"}
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

          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">
              Lokal integritet
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--ss-neutral-800)]">
              <p>
                Den här webbläsaren kan spara tillfälliga utkast, planeringsanteckningar,
                synkköer och onboardingstatus lokalt så att arbetet går att återställa.
              </p>
              <p>
                På delade enheter bör du rensa lokal data när du är klar. Cloudsyncade
                planeringsanteckningar och supportmeddelanden raderas inte av den här knappen.
              </p>
              <ClearLocalDataButton />
            </div>
          </section>

          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--ss-primary)]">
              Konto och rättigheter
            </p>
            <div className="mt-5 space-y-5 text-sm leading-7 text-[var(--ss-neutral-800)]">
              <form action={updateEmailAction} className="space-y-3">
                <label htmlFor="email" className="block font-medium text-[var(--ss-neutral-900)]">
                  Byt e-postadress
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={userEmail ?? profile.email}
                  autoComplete="email"
                  className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
                />
                <AuthSubmitButton
                  type="submit"
                  idleLabel="Skicka bekräftelselänk"
                  pendingLabel="Skickar..."
                  className="h-11 rounded-full px-5"
                />
              </form>

              <div className="rounded-[1.5rem] border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)] p-5">
                <p className="font-medium text-[var(--ss-neutral-900)]">Exportera kontodata</p>
                <p className="mt-2">
                  Exporten innehåller profil, användningsmetadata, betalningsprojektioner,
                  supportärenden och molnsynkad planering för ditt konto.
                </p>
                <a
                  href="/api/account/export"
                  className="mt-4 inline-flex rounded-full border border-[var(--ss-neutral-200)] bg-white px-5 py-2 font-medium text-[var(--ss-neutral-900)] hover:bg-[var(--ss-neutral-50)]"
                >
                  Ladda ner JSON-export
                </a>
              </div>

              <form
                action={requestAccountDeletionAction}
                className="space-y-3 rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-red-900"
              >
                <p className="font-medium">Begär kontoradering</p>
                <p>
                  Detta skapar en adminhanterad begäran så att betalning, supporthistorik och
                  lagringskrav kan kontrolleras innan kontot tas bort.
                </p>
                <label htmlFor="deleteReason" className="block text-sm font-medium">
                  Kommentar, valfritt
                </label>
                <textarea
                  id="deleteReason"
                  name="reason"
                  maxLength={1000}
                  className="min-h-24 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-[var(--ss-neutral-900)]"
                />
                <label htmlFor="deleteConfirmation" className="block text-sm font-medium">
                  Skriv RADERA för att bekräfta
                </label>
                <Input
                  id="deleteConfirmation"
                  name="confirmation"
                  className="h-12 rounded-2xl bg-white"
                />
                <AuthSubmitButton
                  type="submit"
                  idleLabel="Begär kontoradering"
                  pendingLabel="Registrerar..."
                  className="h-11 rounded-full bg-red-700 px-5 text-white hover:bg-red-800"
                />
              </form>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
