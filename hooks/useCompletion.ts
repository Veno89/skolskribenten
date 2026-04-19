"use client";

import { useState } from "react";

interface CompletionRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
}

interface UseCompletionOptions {
  api: string;
}

interface UseCompletionResult {
  complete: (prompt: string, options?: CompletionRequestOptions) => Promise<string>;
  completion: string;
  isLoading: boolean;
  error?: Error;
  reset: () => void;
}

export function useCompletion({ api }: UseCompletionOptions): UseCompletionResult {
  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const reset = () => {
    setCompletion("");
    setError(undefined);
  };

  const complete = async (
    prompt: string,
    options?: CompletionRequestOptions,
  ): Promise<string> => {
    setCompletion("");
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body: JSON.stringify(options?.body ?? { prompt }),
      });

      if (!response.ok) {
        let message = "Kunde inte generera dokumentet.";

        try {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        } catch {
          // Fall back to the default message if the response body is not JSON.
        }

        throw new Error(message);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("Inget svar mottogs från servern.");
      }

      const decoder = new TextDecoder();
      let nextCompletion = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          nextCompletion += decoder.decode();
          break;
        }

        nextCompletion += decoder.decode(value, { stream: true });
        setCompletion(nextCompletion);
      }

      setCompletion(nextCompletion);
      return nextCompletion;
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("Kunde inte generera dokumentet.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    complete,
    completion,
    isLoading,
    error,
    reset,
  };
}
