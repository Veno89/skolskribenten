import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/(auth)/actions";
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
      <form action={loginAction} className="space-y-5">
        {notice ? <AuthNotice type={notice.type} message={notice.message} /> : null}
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
    </AuthShell>
  );
}
