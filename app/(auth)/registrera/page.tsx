import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/(auth)/actions";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { Input } from "@/components/ui/input";
import {
  getNoticeFromSearchParams,
  getStringParam,
  sanitizeNextPath,
  type AuthSearchParams,
} from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

interface Props {
  searchParams?: AuthSearchParams;
}

export default async function RegistreraPage({ searchParams }: Props): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = sanitizeNextPath(getStringParam(searchParams?.next));

  if (user) {
    redirect(next);
  }

  const notice = getNoticeFromSearchParams(searchParams);

  return (
    <AuthShell
      eyebrow="Registrera"
      title="Skapa ditt lärarkonto"
      description="Vi använder kontot för åtkomst, användningsräkning och abonnemang. Ingen rå dokumentation sparas."
      footer={
        <p>
          Har du redan ett konto?{" "}
          <Link
            href={`/logga-in?next=${encodeURIComponent(next)}`}
            className="text-[var(--ss-primary)] hover:underline"
          >
            Logga in här
          </Link>
          .
        </p>
      }
    >
      <form action={registerAction} className="space-y-5">
        {notice ? <AuthNotice type={notice.type} message={notice.message} /> : null}
        <input type="hidden" name="next" value={next} />

        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium text-[var(--ss-neutral-900)]">
            Namn
          </label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            placeholder="För- och efternamn"
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
            autoComplete="organization"
            placeholder="Valfritt"
            className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-[var(--ss-neutral-900)]">
            E-postadress
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="namn@skola.se"
            className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[var(--ss-neutral-900)]">
              Lösenord
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-[var(--ss-neutral-900)]"
            >
              Bekräfta lösenord
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
            />
          </div>
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          Efter registrering skickar vi en bekräftelselänk till din e-postadress.
        </p>

        <p className="text-xs leading-6 text-muted-foreground">
          Genom att skapa konto godkänner du våra{" "}
          <Link href="/anvandarvillkor" className="text-[var(--ss-primary)] hover:underline">
            användarvillkor
          </Link>{" "}
          och kan läsa mer om hur vi hanterar kontodata i{" "}
          <Link href="/integritetspolicy" className="text-[var(--ss-primary)] hover:underline">
            integritetspolicyn
          </Link>
          .
        </p>

        <AuthSubmitButton
          type="submit"
          idleLabel="Skapa konto"
          pendingLabel="Skapar konto..."
          className="h-12 w-full rounded-2xl"
        />
      </form>
    </AuthShell>
  );
}
