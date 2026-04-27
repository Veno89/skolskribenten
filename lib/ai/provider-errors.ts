export type AiProviderErrorCode =
  | "AI_PROVIDER_BAD_REQUEST"
  | "AI_PROVIDER_ERROR"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_TIMEOUT";

export interface ClassifiedAiProviderError {
  code: AiProviderErrorCode;
  status: 502 | 503 | 504;
  userMessage: string;
}

function getErrorField(error: unknown, field: string): unknown {
  if (!error || typeof error !== "object") {
    return null;
  }

  return (error as Record<string, unknown>)[field];
}

export function classifyAiProviderError(error: unknown): ClassifiedAiProviderError {
  const name = getErrorField(error, "name");
  const code = getErrorField(error, "code");
  const message = getErrorField(error, "message");
  const statusCode = getErrorField(error, "statusCode");
  const status = getErrorField(error, "status");
  const normalizedMessage = typeof message === "string" ? message.toLowerCase() : "";
  const numericStatus =
    typeof statusCode === "number" ? statusCode : typeof status === "number" ? status : null;

  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ABORT_ERR" ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("timeout")
  ) {
    return {
      code: "AI_PROVIDER_TIMEOUT",
      status: 504,
      userMessage: "AI-tjänsten tog för lång tid att svara. Försök igen om en stund.",
    };
  }

  if (numericStatus === 429) {
    return {
      code: "AI_PROVIDER_RATE_LIMITED",
      status: 503,
      userMessage: "AI-tjänsten är tillfälligt hårt belastad. Försök igen om en stund.",
    };
  }

  if (numericStatus && numericStatus >= 400 && numericStatus < 500) {
    return {
      code: "AI_PROVIDER_BAD_REQUEST",
      status: 502,
      userMessage: "Genereringen kunde inte startas med den aktuella AI-konfigurationen.",
    };
  }

  return {
    code: "AI_PROVIDER_ERROR",
    status: 502,
    userMessage: "Genereringen misslyckades. Försök igen om en stund.",
  };
}
