"use client";

import { useEffect } from "react";
import { DashboardErrorState } from "@/components/dashboard/DashboardErrorState";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props): JSX.Element {
  useEffect(() => {
    console.error("Dashboard route error", error);
  }, [error]);

  return (
    <DashboardErrorState
      actionLabel="Ladda om vyn"
      digest={error.digest}
      eyebrow="Något gick fel"
      message="Dashboarden kunde inte läsa in den här vyn just nu. Försök igen."
      onAction={reset}
      title="Vyn kunde inte visas"
    />
  );
}
