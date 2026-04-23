const MINUTE_IN_MS = 60 * 1000;

export const SUPPORT_RATE_LIMIT_WINDOW_MINUTES = 15;
export const SUPPORT_RATE_LIMIT_MAX_REQUESTS = 3;
export const SUPPORT_DUPLICATE_WINDOW_MINUTES = 10;

interface RecentSupportRequest {
  created_at: string;
  message: string;
}

export function getSupportRateLimitWindowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - SUPPORT_RATE_LIMIT_WINDOW_MINUTES * MINUTE_IN_MS).toISOString();
}

export function isSupportHoneypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeSupportEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeSupportMessage(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function hasExceededSupportRateLimit(
  recentRequests: RecentSupportRequest[],
  maxRequests: number = SUPPORT_RATE_LIMIT_MAX_REQUESTS,
): boolean {
  return recentRequests.length >= Math.max(maxRequests, 1);
}

export function isDuplicateSupportRequest(
  recentRequests: RecentSupportRequest[],
  message: string,
  now: Date = new Date(),
): boolean {
  const normalizedMessage = normalizeSupportMessage(message);
  const duplicateWindowStart = now.getTime() - SUPPORT_DUPLICATE_WINDOW_MINUTES * MINUTE_IN_MS;

  return recentRequests.some((request) => {
    const createdAt = new Date(request.created_at).getTime();

    if (Number.isNaN(createdAt) || createdAt < duplicateWindowStart) {
      return false;
    }

    return normalizeSupportMessage(request.message) === normalizedMessage;
  });
}
