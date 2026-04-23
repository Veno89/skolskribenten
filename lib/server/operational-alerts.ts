import type { LogDetails, RouteContext } from "@/lib/server/request-context";

interface OperationalErrorSummary {
  code?: string;
  providerRequestId?: string;
  statusCode?: number;
  type?: string;
}

export interface OperationalAlertPayload {
  appEnv: string;
  event: {
    details?: LogDetails;
    error?: OperationalErrorSummary;
    level: "error";
    message: string;
  };
  route: {
    method: string;
    path: string;
    requestId: string;
    routeName: string;
  };
  sentAt: string;
  source: "skolskribenten";
}

const MAX_STRING_LENGTH = 180;
const REDACTED_KEYWORDS = [
  "authorization",
  "body",
  "content",
  "cookie",
  "email",
  "input",
  "message",
  "name",
  "note",
  "output",
  "password",
  "prompt",
  "scrubbed",
  "secret",
  "text",
  "token",
];

function getAppEnv(): string {
  return process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return REDACTED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function sanitizeDetailValue(value: boolean | number | string | null | undefined): boolean | number | string | null | undefined {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed.length <= MAX_STRING_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_STRING_LENGTH)}...`;
}

function sanitizeDetails(details?: LogDetails): LogDetails | undefined {
  if (!details) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(details).flatMap(([key, value]) => {
    if (isSensitiveKey(key)) {
      return [];
    }

    return [[key, sanitizeDetailValue(value)] as const];
  });

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

function summarizeErrorForOps(error: unknown): OperationalErrorSummary | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as Record<string, unknown>;
  const summary: OperationalErrorSummary = {};

  if (typeof candidate.type === "string") {
    summary.type = candidate.type;
  }

  if (typeof candidate.code === "string") {
    summary.code = candidate.code;
  }

  if (typeof candidate.statusCode === "number") {
    summary.statusCode = candidate.statusCode;
  }

  if (typeof candidate.requestId === "string") {
    summary.providerRequestId = candidate.requestId;
  }

  return Object.keys(summary).length > 0 ? summary : undefined;
}

function summarizeDeliveryError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown delivery error";
}

export function buildOperationalAlertPayload(
  context: RouteContext,
  message: string,
  details?: LogDetails,
  error?: unknown,
): OperationalAlertPayload {
  const sanitizedDetails = sanitizeDetails(details);
  const errorSummary = summarizeErrorForOps(error);

  return {
    appEnv: getAppEnv(),
    event: {
      ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
      ...(errorSummary ? { error: errorSummary } : {}),
      level: "error",
      message,
    },
    route: {
      method: context.method,
      path: context.pathname,
      requestId: context.requestId,
      routeName: context.routeName,
    },
    sentAt: new Date().toISOString(),
    source: "skolskribenten",
  };
}

export async function sendOperationalAlert(
  payload: OperationalAlertPayload,
  webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL,
): Promise<boolean> {
  if (!webhookUrl) {
    return false;
  }

  const response = await fetch(webhookUrl, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "skolskribenten-ops-alert/1.0",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Operational alert webhook failed with status ${response.status}.`);
  }

  return true;
}

export function queueOperationalErrorAlert(
  context: RouteContext,
  message: string,
  details?: LogDetails,
  error?: unknown,
): void {
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  const payload = buildOperationalAlertPayload(context, message, details, error);

  void sendOperationalAlert(payload, webhookUrl).catch((deliveryError) => {
    console.error("[Ops] Failed to deliver operational alert.", {
      deliveryError: summarizeDeliveryError(deliveryError),
      method: context.method,
      path: context.pathname,
      requestId: context.requestId,
      routeName: context.routeName,
    });
  });
}
