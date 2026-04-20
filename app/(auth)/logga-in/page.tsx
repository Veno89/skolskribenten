import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction, resendConfirmationAction } from "@/app/(auth)/actions";
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

export default async function LoggaInPage({ searchParams }: Props): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const next = sanitizeNextPath(getStringParam(searchParams?.next));

  if (user) {
    redirect(next);
  }

  const notice = getNoticeFromSearchParams(searchParams);
  const resendEmail = getStringParam(searchParams?.resendEmail);

  return (
    <AuthShell
      eyebrow="Logga in"
      title="Välkommen tillbaka"
      description="Logga in för att fortsätta till skrivstationen och ditt konto."
      footer={
        <p>
          Saknar du konto?{" "}
          <Link
            href={`/registrera?next=${encodeURIComponent(next)}`}
            className="text-[var(--ss-primary)] hover:underline"
          >
            Registrera dig här
          </Link>
          . Behöver du ett nytt lösenord?{" "}
          <Link href="/aterstall" className="text-[var(--ss-primary)] hover:underline">
            Återställ här
          </Link>
          .
        </p>
      }
    >
      <div className="space-y-5">
        {notice ? <AuthNotice type={notice.type} message={notice.message} /> : null}

        {resendEmail ? (
          <form
            action={resendConfirmationAction}
            className="rounded-[1.25rem] border border-[var(--ss-primary)]/20 bg-[var(--ss-primary-light)] px-4 py-4"
          >
            <p className="text-sm font-medium text-[var(--ss-neutral-900)]">
              Saknas bekräftelsemejlet?
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--ss-primary-dark)]">
              Skicka en ny bekräftelselänk till <strong>{resendEmail}</strong>.
            </p>
            <input type="hidden" name="email" value={resendEmail} />
            <input type="hidden" name="next" value={next} />
            <AuthSubmitButton
              type="submit"
              idleLabel="Skicka bekräftelsen igen"
              pendingLabel="Skickar..."
              variant="outline"
              className="mt-4 rounded-full"
            />
          </form>
        ) : null}

        <form action={loginAction} className="space-y-5">
          <input type="hidden" name="next" value={next} />

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

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[var(--ss-neutral-900)]">
              Lösenord
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
            />
          </div>

          <AuthSubmitButton
            type="submit"
            idleLabel="Logga in"
            pendingLabel="Loggar in..."
            className="h-12 w-full rounded-2xl"
          />
        </form>
      </div>
    </AuthShell>
  );
}
