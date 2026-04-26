"use client";

import { signOutAction } from "@/app/(auth)/actions";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import type { ButtonProps } from "@/components/ui/button";
import { clearAllLocalAppStorage } from "@/lib/privacy/local-data";

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
  const handleSubmit = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      clearAllLocalAppStorage(window.localStorage);
      clearAllLocalAppStorage(window.sessionStorage);
    } catch {
      // Ignore browsers where storage is unavailable.
    }
  };

  return (
    <form action={signOutAction} onSubmit={handleSubmit}>
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
