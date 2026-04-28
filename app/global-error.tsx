"use client";

import { useEffect } from "react";
import NextError from "next/error";
import * as Sentry from "@sentry/nextjs";

interface Props {
  error: Error & { digest?: string };
}

export default function GlobalError({ error }: Props): JSX.Element {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="sv">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
