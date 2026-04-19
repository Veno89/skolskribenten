"use client";

import { signOutAction } from "@/app/(auth)/actions";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import type { ButtonProps } from "@/components/ui/button";

interface Props {
  className?: string;
  idleLabel?: string;
  pendingLabel?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

export function SignOutButton({
  className,
  idleLabel = "Logga ut",
  pendingLabel = "Loggar ut...",
  size = "default",
  variant = "outline",
}: Props): JSX.Element {
  return (
    <form action={signOutAction}>
      <AuthSubmitButton
        type="submit"
        size={size}
        variant={variant}
        className={className}
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
}
