import { NextRequest } from "next/server";
import {
  createRouteContext,
  logRouteInfo,
  withRequestContext,
} from "@/lib/server/request-context";

const MAX_REPORT_BYTES = 10_000;

function summarizeCspReport(report: unknown): Record<string, string | undefined> {
  if (!report || typeof report !== "object") {
    return {};
  }

  const root = report as Record<string, unknown>;
  const body =
    typeof root["csp-report"] === "object" && root["csp-report"]
      ? (root["csp-report"] as Record<string, unknown>)
      : root;

  return {
    blockedUri: typeof body["blocked-uri"] === "string" ? body["blocked-uri"].slice(0, 160) : undefined,
    documentUri:
      typeof body["document-uri"] === "string" ? body["document-uri"].slice(0, 160) : undefined,
    effectiveDirective:
      typeof body["effective-directive"] === "string"
        ? body["effective-directive"].slice(0, 80)
        : undefined,
    violatedDirective:
      typeof body["violated-directive"] === "string"
        ? body["violated-directive"].slice(0, 120)
        : undefined,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const context = createRouteContext(req, "csp.report");
  const contentLength = Number.parseInt(req.headers.get("content-length") ?? "0", 10);

  if (contentLength > MAX_REPORT_BYTES) {
    return withRequestContext(new Response(null, { status: 413 }), context);
  }

  try {
    const payload = await req.json();
    logRouteInfo(context, "Received CSP report.", summarizeCspReport(payload));
  } catch {
    logRouteInfo(context, "Received malformed CSP report.");
  }

  return withRequestContext(new Response(null, { status: 204 }), context);
}
