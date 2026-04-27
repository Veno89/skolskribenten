import type { Database } from "@/types/database";

export type AiUsageEventRow = Pick<
  Database["public"]["Tables"]["usage_events"]["Row"],
  | "ai_model"
  | "ai_provider"
  | "created_at"
  | "output_guard_passed"
  | "output_guard_version"
  | "output_guard_warnings"
  | "prompt_version"
  | "template_type"
>;

export interface AiGovernanceStats {
  blockedCount: number;
  eventCount: number;
  latestEventAt: string | null;
  versionRows: Array<{
    aiModel: string;
    blockedCount: number;
    eventCount: number;
    outputGuardVersion: string;
    promptVersion: string;
    warningCount: number;
  }>;
  warningCount: number;
}

export function summarizeAiGovernanceEvents(events: AiUsageEventRow[]): AiGovernanceStats {
  const byVersion = new Map<
    string,
    {
      aiModel: string;
      blockedCount: number;
      eventCount: number;
      outputGuardVersion: string;
      promptVersion: string;
      warningCount: number;
    }
  >();

  let blockedCount = 0;
  let latestEventAt: string | null = null;
  let warningCount = 0;

  events.forEach((event) => {
    const eventWarningCount = event.output_guard_warnings.length;
    const key = `${event.prompt_version}:${event.output_guard_version}:${event.ai_model}`;
    const existing =
      byVersion.get(key) ??
      {
        aiModel: event.ai_model,
        blockedCount: 0,
        eventCount: 0,
        outputGuardVersion: event.output_guard_version,
        promptVersion: event.prompt_version,
        warningCount: 0,
      };

    existing.eventCount += 1;
    existing.warningCount += eventWarningCount;
    warningCount += eventWarningCount;

    if (!event.output_guard_passed) {
      existing.blockedCount += 1;
      blockedCount += 1;
    }

    byVersion.set(key, existing);

    if (!latestEventAt || event.created_at > latestEventAt) {
      latestEventAt = event.created_at;
    }
  });

  return {
    blockedCount,
    eventCount: events.length,
    latestEventAt,
    versionRows: Array.from(byVersion.values()).sort((a, b) => b.eventCount - a.eventCount),
    warningCount,
  };
}

export function formatGuardPassRate(stats: Pick<AiGovernanceStats, "blockedCount" | "eventCount">): string {
  if (stats.eventCount === 0) {
    return "Ej mätt";
  }

  const passRate = ((stats.eventCount - stats.blockedCount) / stats.eventCount) * 100;
  return `${passRate.toFixed(1)}%`;
}
