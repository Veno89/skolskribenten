import { describe, expect, it } from "vitest";
import { classifyAiProviderError } from "@/lib/ai/provider-errors";

describe("classifyAiProviderError", () => {
  it("classifies timeout-like errors as gateway timeouts", () => {
    const result = classifyAiProviderError(Object.assign(new Error("Request timed out"), {
      name: "TimeoutError",
    }));

    expect(result).toMatchObject({
      code: "AI_PROVIDER_TIMEOUT",
      status: 504,
    });
  });

  it("classifies provider rate limits without exposing provider details", () => {
    const result = classifyAiProviderError({ statusCode: 429, message: "rate limited" });

    expect(result).toMatchObject({
      code: "AI_PROVIDER_RATE_LIMITED",
      status: 503,
    });
  });
});
