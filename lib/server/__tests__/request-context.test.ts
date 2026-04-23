import { beforeEach, describe, expect, it, vi } from "vitest";

const queueOperationalErrorAlert = vi.fn();

vi.mock("@/lib/server/operational-alerts", () => ({
  queueOperationalErrorAlert,
}));

describe("request context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a route context with sanitized request metadata", async () => {
    const { createRouteContext } = await import("@/lib/server/request-context");

    const context = createRouteContext(
      new Request("http://localhost/api/support", {
        headers: {
          "x-request-id": "req.from-proxy-123",
        },
        method: "post",
      }),
      "support",
    );

    expect(context).toEqual({
      method: "POST",
      pathname: "/api/support",
      requestId: "req.from-proxy-123",
      routeName: "support",
    });
  });

  it("forwards route errors to the operational alert queue", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { logRouteError } = await import("@/lib/server/request-context");

    const context = {
      method: "POST",
      pathname: "/api/support",
      requestId: "req_123",
      routeName: "support",
    };
    const error = {
      code: "PGRST301",
      statusCode: 500,
    };

    logRouteError(context, "Support request failed.", error, {
      customerId: "cus_123",
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(queueOperationalErrorAlert).toHaveBeenCalledWith(
      context,
      "Support request failed.",
      {
        customerId: "cus_123",
      },
      error,
    );
  });
});
