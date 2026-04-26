"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearAllLocalAppStorage } from "@/lib/privacy/local-data";

export function ClearLocalDataButton(): JSX.Element {
  const [status, setStatus] = useState<"idle" | "cleared" | "failed">("idle");

  const handleClear = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const removed =
        clearAllLocalAppStorage(window.localStorage) +
        clearAllLocalAppStorage(window.sessionStorage);

      setStatus("cleared");
      window.setTimeout(() => setStatus("idle"), 3500);

      if (removed > 0) {
        window.dispatchEvent(new Event("skolskribenten:local-data-cleared"));
      }
    } catch {
      setStatus("failed");
      window.setTimeout(() => setStatus("idle"), 3500);
    }
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="rounded-full" onClick={handleClear}>
        Rensa lokal data på den här enheten
      </Button>
      {status === "cleared" ? (
        <p aria-live="polite" className="text-xs leading-6 text-emerald-700">
          Lokal data rensades på den här enheten.
        </p>
      ) : null}
      {status === "failed" ? (
        <p aria-live="polite" className="text-xs leading-6 text-red-700">
          Lokal data kunde inte rensas i den här webbläsaren.
        </p>
      ) : null}
    </div>
  );
}
