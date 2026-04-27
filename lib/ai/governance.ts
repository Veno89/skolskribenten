import { CLAUDE_PRIMARY_MODEL } from "@/lib/ai/provider";

export const AI_PROVIDER = "anthropic";
export const AI_PROMPT_VERSION = "skolskribenten-prompt-2026-04-26-v1";
export const AI_OUTPUT_GUARD_VERSION = "skolskribenten-output-guard-2026-04-26-v1";
export const AI_GENERATION_TIMEOUT_MS = 60_000;

export function getAiGovernanceMetadata() {
  return {
    ai_model: CLAUDE_PRIMARY_MODEL,
    ai_provider: AI_PROVIDER,
    output_guard_version: AI_OUTPUT_GUARD_VERSION,
    prompt_version: AI_PROMPT_VERSION,
  };
}
