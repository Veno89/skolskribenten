import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOperationalAlertPayload,
  buildOperationalInfoPayload,
  sendOperationalAlert,
} from "@/lib/server/operational-alerts";
import type { RouteContext } from "@/lib/server/request-context";

const context: RouteContext = {
  method: "POST",
  pathname: "/api/support",
  requestId: "req_123",
  routeName: "support",
};

describe("operational alerts", () => {
  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds a sanitized payload without teacher-facing content fields", () => {
    process.env.APP_ENV = "production";

    const payload = buildOperationalAlertPayload(
      context,
      "Failed to create support request.",
      {
        customerId: "cus_123",
        email: "larare@skola.se",
        message: "Det h\u00e4r ska inte skickas vidare.",
        prompt: "R\u00e5 prompt",
        topic: "Tekniskt problem",
      },
      {
        code: "PGRST301",
        message: "Do not include this external error message.",
        requestId: "provider_req_456",
        statusCode: 500,
        type: "database_error",
      },
    );

    expect(payload.appEnv).toBe("production");
    expect(payload.route).toEqual({
      method: "POST",
      path: "/api/support",
      requestId: "req_123",
      routeName: "support",
    });
    expect(payload.event).toEqual({
      details: {
        customerId: "cus_123",
        topic: "Tekniskt problem",
      },
      error: {
        code: "PGRST301",
        providerRequestId: "provider_req_456",
        statusCode: 500,
        type: "database_error",
      },
      level: "error",
      message: "Failed to create support request.",
    });
  });

  it("posts operational alerts to the configured webhook", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://ops.example.com/webhook";

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = buildOperationalAlertPayload(context, "Generation failed.");
    const sent = await sendOperationalAlert(payload);

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ops.example.com/webhook",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(requestInit.headers).toEqual({
      "Content-Type": "application/json",
      "User-Agent": "skolskribenten-ops-alert/1.0",
    });
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      event: {
        level: "error",
        message: "Generation failed.",
      },
      route: {
        requestId: "req_123",
      },
      source: "skolskribenten",
    });
  });

  it("builds sanitized info events for support notifications", () => {
    const payload = buildOperationalInfoPayload(
      context,
      "New support request received.",
      {
        email: "larare@skola.se",
        message: "Do not send this",
        supportRequestId: "req_123",
        topic: "Tekniskt problem",
        userId: "user-123",
      },
    );

    expect(payload.event).toEqual({
      details: {
        supportRequestId: "req_123",
        topic: "Tekniskt problem",
        userId: "user-123",
      },
      level: "info",
      message: "New support request received.",
    });
  });

  it("skips webhook delivery when no operational webhook is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendOperationalAlert(buildOperationalAlertPayload(context, "Support failed."));

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
