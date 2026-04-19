"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props extends ButtonProps {
  idleLabel: string;
  pendingLabel: string;
}

export function AuthSubmitButton({
  idleLabel,
  pendingLabel,
  disabled,
  ...props
}: Props): JSX.Element {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={disabled || pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
