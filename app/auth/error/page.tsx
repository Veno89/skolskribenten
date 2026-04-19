import Link from "next/link";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthShell } from "@/components/auth/AuthShell";
import { getNoticeFromSearchParams, type AuthSearchParams } from "@/lib/auth/redirects";

interface Props {
  searchParams?: AuthSearchParams;
}

export default function AuthErrorPage({ searchParams }: Props): JSX.Element {
  const notice = getNoticeFromSearchParams(searchParams) ?? {
    type: "error" as const,
    message: "Länken kunde inte verifieras. Be om en ny och försök igen.",
  };

  return (
    <AuthShell
      eyebrow="Verifiering"
      title="Något gick fel i bekräftelsen"
      description="Det här händer oftast när länken redan har använts eller hunnit löpa ut."
      footer={
        <div className="flex flex-wrap gap-4">
          <Link href="/logga-in" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Till inloggningen
          </Link>
          <Link href="/aterstall" className="transition-colors hover:text-[var(--ss-neutral-900)]">
            Be om ny återställningslänk
          </Link>
        </div>
      }
    >
      <AuthNotice type={notice.type} message={notice.message} />
    </AuthShell>
  );
}
