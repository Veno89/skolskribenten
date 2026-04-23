import Link from "next/link";
import { requestPasswordResetAction, updatePasswordAction } from "@/app/(auth)/actions";
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
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
} from "@/lib/auth/password-policy";
import { createClient } from "@/lib/supabase/server";

interface Props {
  searchParams?: AuthSearchParams;
}

export default async function AterstallPage({ searchParams }: Props): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const mode = getStringParam(searchParams?.mode);
  const next = sanitizeNextPath(getStringParam(searchParams?.next));
  const showUpdateForm = mode === "update" || Boolean(user);
  const notice = getNoticeFromSearchParams(searchParams);
  const fallbackNotice =
    mode === "update" && !user
      ? {
          type: "error" as const,
          message: "Länken har löpt ut eller har redan använts. Be om en ny återställningslänk.",
        }
      : null;
  const activeNotice = notice ?? fallbackNotice;

  return (
    <AuthShell
      eyebrow="Lösenord"
      title={showUpdateForm ? "Välj ett nytt lösenord" : "Återställ lösenord"}
      description={
        showUpdateForm
          ? "Spara ett nytt lösenord för ditt konto och fortsätt sedan tillbaka till skrivstationen."
          : "Fyll i din e-postadress så skickar vi en återställningslänk om kontot finns registrerat."
      }
      footer={
        <p>
          Vill du tillbaka istället?{" "}
          <Link href="/logga-in" className="text-[var(--ss-primary)] hover:underline">
            Till inloggningen
          </Link>
          .
        </p>
      }
    >
      {showUpdateForm ? (
        <form action={updatePasswordAction} className="space-y-5">
          {activeNotice ? <AuthNotice type={activeNotice.type} message={activeNotice.message} /> : null}
          <input type="hidden" name="next" value={next} />

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-[var(--ss-neutral-900)]">
              Nytt lösenord
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-[var(--ss-neutral-900)]"
            >
              Bekräfta nytt lösenord
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
              className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
            />
          </div>

          <p className="text-xs leading-6 text-muted-foreground">
            {PASSWORD_REQUIREMENTS_TEXT}
          </p>

          <AuthSubmitButton
            type="submit"
            idleLabel="Spara nytt lösenord"
            pendingLabel="Sparar..."
            className="h-12 w-full rounded-2xl"
          />
        </form>
      ) : (
        <form action={requestPasswordResetAction} className="space-y-5">
          {activeNotice ? <AuthNotice type={activeNotice.type} message={activeNotice.message} /> : null}

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

          <AuthSubmitButton
            type="submit"
            idleLabel="Skicka återställningslänk"
            pendingLabel="Skickar..."
            className="h-12 w-full rounded-2xl"
          />
        </form>
      )}
    </AuthShell>
  );
}
