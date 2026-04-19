import { cn } from "@/lib/utils";
import type { AuthMessageType } from "@/lib/auth/redirects";

interface Props {
  type: AuthMessageType;
  message: string;
}

export function AuthNotice({ type, message }: Props): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border px-4 py-3 text-sm leading-6",
        type === "success" && "border-green-200 bg-green-50 text-green-800",
        type === "error" && "border-red-200 bg-red-50 text-red-800",
        type === "info" && "border-[var(--ss-primary)]/20 bg-[var(--ss-primary-light)] text-[var(--ss-primary-dark)]",
      )}
    >
      {message}
    </div>
  );
}
