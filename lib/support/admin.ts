import { z } from "zod";

export const SUPPORT_REQUEST_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "spam",
  "redacted",
  "deleted",
] as const;

export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export const OPEN_SUPPORT_REQUEST_STATUSES = [
  "new",
  "triaged",
  "in_progress",
] satisfies SupportRequestStatus[];

export const SUPPORT_REQUEST_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  deleted: "Raderad",
  in_progress: "Pågår",
  new: "Ny",
  redacted: "Redigerad",
  resolved: "Löst",
  spam: "Spam",
  triaged: "Triagerad",
};

export const SUPPORT_STATUS_FILTERS = [
  "open",
  "all",
  ...SUPPORT_REQUEST_STATUSES,
] as const;

export type SupportStatusFilter = (typeof SUPPORT_STATUS_FILTERS)[number];

export const SupportRequestStatusSchema = z.enum(SUPPORT_REQUEST_STATUSES);
export const SupportStatusFilterSchema = z.enum(SUPPORT_STATUS_FILTERS);

export const SupportRequestIdSchema = z
  .string()
  .uuid("Ogiltigt supportärende.");

export const SupportStatusActionSchema = z.object({
  requestId: SupportRequestIdSchema,
  status: SupportRequestStatusSchema,
  statusFilter: SupportStatusFilterSchema.catch("open"),
});

export const SupportRequestActionSchema = z.object({
  requestId: SupportRequestIdSchema,
  statusFilter: SupportStatusFilterSchema.catch("open"),
});

export const SUPPORT_REDACTED_PLACEHOLDER = "[redacted by support admin]";
export const SUPPORT_DELETED_PLACEHOLDER = "[deleted by support admin]";

export function parseSupportStatusFilter(value: unknown): SupportStatusFilter {
  const parsed = SupportStatusFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : "open";
}

export function getSupportStatusFilterStatuses(
  filter: SupportStatusFilter,
): SupportRequestStatus[] | null {
  if (filter === "all") {
    return null;
  }

  if (filter === "open") {
    return [...OPEN_SUPPORT_REQUEST_STATUSES];
  }

  return [filter];
}

export function shouldStampSupportRequestHandledAt(status: SupportRequestStatus): boolean {
  return status === "resolved" || status === "spam" || status === "redacted" || status === "deleted";
}

export function buildSupportRequestStatusUpdate(
  status: SupportRequestStatus,
  now: string,
): {
  handled_at?: string;
  status: SupportRequestStatus;
} {
  return shouldStampSupportRequestHandledAt(status)
    ? { handled_at: now, status }
    : { status };
}

export function buildSupportRequestRedactionUpdate(now: string): {
  email: string;
  handled_at: string;
  message: string;
  name: string;
  redacted_at: string;
  role: null;
  status: "redacted";
} {
  return {
    email: "redacted@support.skolskribenten.local",
    handled_at: now,
    message: SUPPORT_REDACTED_PLACEHOLDER,
    name: SUPPORT_REDACTED_PLACEHOLDER,
    redacted_at: now,
    role: null,
    status: "redacted",
  };
}

export function buildSupportRequestSoftDeletionUpdate(now: string): {
  deleted_at: string;
  email: string;
  handled_at: string;
  message: string;
  name: string;
  redacted_at: string;
  role: null;
  status: "deleted";
} {
  return {
    deleted_at: now,
    email: "deleted@support.skolskribenten.local",
    handled_at: now,
    message: SUPPORT_DELETED_PLACEHOLDER,
    name: SUPPORT_DELETED_PLACEHOLDER,
    redacted_at: now,
    role: null,
    status: "deleted",
  };
}
