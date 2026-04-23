import { NextResponse } from "next/server";
import { queueOperationalErrorAlert } from "@/lib/server/operational-alerts";

export interface RouteContext {
  method: string;
  pathname: string;
  requestId: string;
  routeName: string;
}

export type LogDetails = Record<string, boolean | number | string | null | undefined>;

function sanitizeRequestId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > 120 || !/^[A-Za-z0-9._:/=-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function summarizeError(error: unknown): LogDetails | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  const summary: LogDetails = {};

  if (typeof candidate.message === "string") {
    summary.message = candidate.message;
  }

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

  return Object.keys(summary).length > 0 ? summary : null;
}

function buildLogPayload(context: RouteContext, details?: LogDetails, error?: unknown): LogDetails {
  const payload: LogDetails = {
    method: context.method,
    path: context.pathname,
    requestId: context.requestId,
    routeName: context.routeName,
    ...details,
  };
  const errorSummary = summarizeError(error);

  if (errorSummary) {
    return { ...payload, ...errorSummary };
  }

  return payload;
}

export function createRouteContext(req: Request, routeName: string): RouteContext {
  return {
    method: req.method.toUpperCase(),
    pathname: new URL(req.url).pathname,
    requestId: sanitizeRequestId(req.headers.get("x-request-id")) ?? crypto.randomUUID(),
    routeName,
  };
}

export function jsonWithContext(
  body: unknown,
  init: ResponseInit,
  context: RouteContext,
): Response {
  const response = NextResponse.json(body, init);
  response.headers.set("X-Request-Id", context.requestId);
  return response;
}

export function withRequestContext(response: Response, context: RouteContext): Response {
  response.headers.set("X-Request-Id", context.requestId);
  return response;
}

export function logRouteInfo(context: RouteContext, message: string, details?: LogDetails): void {
  console.info(`[Route:${context.routeName}] ${message}`, buildLogPayload(context, details));
}

export function logRouteError(
  context: RouteContext,
  message: string,
  error?: unknown,
  details?: LogDetails,
): void {
  console.error(`[Route:${context.routeName}] ${message}`, buildLogPayload(context, details, error));
  queueOperationalErrorAlert(context, message, details, error);
}
