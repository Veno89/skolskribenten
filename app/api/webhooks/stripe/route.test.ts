import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.fn();
const mockCheckoutSessionRetrieve = vi.fn();
const mockListLineItems = vi.fn();
const mockSubscriptionRetrieve = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  createStripeClient: () => ({
    checkout: {
      sessions: {
        listLineItems: mockListLineItems,
        retrieve: mockCheckoutSessionRetrieve,
      },
    },
    subscriptions: {
      retrieve: mockSubscriptionRetrieve,
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

function createEvent(type: string, object: Record<string, unknown> = {}) {
  return {
    id: `evt_${type.replaceAll(".", "_")}`,
    created: 1_745_193_600,
    data: {
      object: {
        id: "obj_123",
        ...object,
      },
    },
    livemode: false,
    type,
  };
}

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_123",
    client_reference_id: "user-123",
    customer: "cus_123",
    line_items: {
      data: [
        {
          price: {
            id: "price_onetime",
          },
        },
      ],
    },
    livemode: false,
    metadata: {
      supabase_user_id: "user-123",
    },
    mode: "payment",
    payment_intent: "pi_123",
    payment_status: "paid",
    status: "complete",
    subscription: null,
    ...overrides,
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    cancel_at_period_end: false,
    customer: "cus_123",
    items: {
      data: [
        {
          current_period_end: 1_747_785_600,
          price: {
            id: "price_monthly",
          },
        },
      ],
    },
    latest_invoice: "in_123",
    status: "active",
    ...overrides,
  };
}

function setupCustomerMapping(userId = "user-123") {
  mockFrom.mockImplementation((table: string) => {
    if (table === "stripe_customer_mappings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                livemode: false,
                stripe_customer_id: "cus_123",
                user_id: userId,
              },
              error: null,
            }),
          })),
        })),
      };
    }

    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

function setupRpc(options: {
  claim?: { processing_attempts: number; should_process: boolean; status: string };
  checkoutProjection?: { applied: boolean; entitlement_access_level: string; entitlement_reason: string };
  subscriptionProjection?: { applied: boolean; entitlement_access_level: string; entitlement_reason: string };
} = {}) {
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === "claim_stripe_event") {
      return {
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.claim ?? {
            processing_attempts: 1,
            should_process: true,
            status: "processing",
          },
          error: null,
        }),
      };
    }

    if (fnName === "apply_checkout_session_projection") {
      return {
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.checkoutProjection ?? {
            applied: true,
            entitlement_access_level: "pro",
            entitlement_reason: "one_time_checkout_paid",
          },
          error: null,
        }),
      };
    }

    if (fnName === "apply_subscription_projection") {
      return {
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.subscriptionProjection ?? {
            applied: true,
            entitlement_access_level: "pro",
            entitlement_reason: "stripe_subscription_active",
          },
          error: null,
        }),
      };
    }

    if (fnName === "complete_stripe_event") {
      return { error: null };
    }

    throw new Error(`Unexpected rpc: ${fnName}`);
  });
}

describe("/api/webhooks/stripe", () => {
  const originalEnv = {
    STRIPE_PRICE_MONTHLY_PRO: process.env.STRIPE_PRICE_MONTHLY_PRO,
    STRIPE_PRICE_ONETIME_30DAY: process.env.STRIPE_PRICE_ONETIME_30DAY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_MONTHLY_PRO = "price_monthly";
    process.env.STRIPE_PRICE_ONETIME_30DAY = "price_onetime";

    setupCustomerMapping();
    setupRpc();
    mockCheckoutSessionRetrieve.mockResolvedValue(checkoutSession());
    mockListLineItems.mockResolvedValue({
      data: [
        {
          price: {
            id: "price_onetime",
          },
        },
      ],
    });
    mockSubscriptionRetrieve.mockResolvedValue(subscription());
  });

  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalEnv.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = originalEnv.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_PRICE_MONTHLY_PRO = originalEnv.STRIPE_PRICE_MONTHLY_PRO;
    process.env.STRIPE_PRICE_ONETIME_30DAY = originalEnv.STRIPE_PRICE_ONETIME_30DAY;
  });

  it("rejects requests without a Stripe signature", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ogiltig signatur.",
    });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("rejects forged webhook signatures", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "forged",
        },
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("grants one-time access only after a verified paid checkout webhook", async () => {
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.completed", { id: "cs_123" }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_checkout_session_projection",
      expect.objectContaining({
        p_access_until: expect.any(String),
        p_payment_status: "paid",
        p_stripe_checkout_session_id: "cs_123",
        p_user_id: "user-123",
      }),
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "complete_stripe_event",
      expect.objectContaining({
        p_status: "processed",
      }),
    );
  });

  it("stores only a sanitized event payload in the durable webhook ledger", async () => {
    mockConstructEvent.mockReturnValue(
      createEvent("checkout.session.completed", {
        customer: "cus_123",
        customer_details: {
          email: "teacher@example.com",
          name: "Sensitive Teacher",
        },
        id: "cs_123",
        payment_status: "paid",
      }),
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    const claimCall = mockRpc.mock.calls.find(([fnName]) => fnName === "claim_stripe_event");
    expect(JSON.stringify(claimCall?.[1].p_payload)).not.toContain("teacher@example.com");
    expect(JSON.stringify(claimCall?.[1].p_payload)).not.toContain("Sensitive Teacher");
    expect(claimCall?.[1].p_payload).toMatchObject({
      data: {
        object: {
          customer: "cus_123",
          id: "cs_123",
          payment_status: "paid",
        },
      },
      id: "evt_checkout_session_completed",
      type: "checkout.session.completed",
    });
  });

  it("does not grant access for success redirects or unpaid checkout completion", async () => {
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.completed", { id: "cs_123" }));
    mockCheckoutSessionRetrieve.mockResolvedValueOnce(checkoutSession({ payment_status: "unpaid" }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_checkout_session_projection",
      expect.objectContaining({
        p_access_until: null,
        p_payment_status: "unpaid",
      }),
    );
  });

  it("skips duplicate webhook deliveries without reapplying state", async () => {
    setupRpc({
      claim: {
        processing_attempts: 1,
        should_process: false,
        status: "processed",
      },
    });
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.completed", { id: "cs_123" }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ duplicate: true, received: true });
    expect(mockCheckoutSessionRetrieve).not.toHaveBeenCalled();
  });

  it("rejects unapproved checkout prices", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.completed", { id: "cs_123" }));
    mockCheckoutSessionRetrieve.mockResolvedValueOnce(
      checkoutSession({
        line_items: {
          data: [
            {
              price: {
                id: "price_attacker",
              },
            },
          ],
        },
      }),
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith(
      "complete_stripe_event",
      expect.objectContaining({
        p_status: "failed",
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("rejects checkout sessions whose trace metadata belongs to another user", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.completed", { id: "cs_123" }));
    mockCheckoutSessionRetrieve.mockResolvedValueOnce(
      checkoutSession({
        metadata: {
          supabase_user_id: "user-456",
        },
      }),
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(500);
    expect(mockRpc).not.toHaveBeenCalledWith(
      "apply_checkout_session_projection",
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  it("handles async payment success and failure without premature access", async () => {
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.async_payment_failed", { id: "cs_123" }));
    mockCheckoutSessionRetrieve.mockResolvedValueOnce(checkoutSession({ payment_status: "unpaid" }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const failedResponse = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(failedResponse.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_checkout_session_projection",
      expect.objectContaining({ p_access_until: null }),
    );

    vi.clearAllMocks();
    setupCustomerMapping();
    setupRpc();
    mockConstructEvent.mockReturnValue(createEvent("checkout.session.async_payment_succeeded", { id: "cs_123" }));
    mockCheckoutSessionRetrieve.mockResolvedValueOnce(checkoutSession({ payment_status: "paid" }));

    const succeededResponse = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(succeededResponse.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_checkout_session_projection",
      expect.objectContaining({ p_access_until: expect.any(String) }),
    );
  });

  it("keeps past_due subscriptions active during the grace period", async () => {
    mockConstructEvent.mockReturnValue(createEvent("customer.subscription.updated", { id: "sub_123" }));
    mockSubscriptionRetrieve.mockResolvedValueOnce(
      subscription({
        latest_invoice: {
          created: 1_745_193_600,
          id: "in_123",
        },
        status: "past_due",
      }),
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_subscription_projection",
      expect.objectContaining({
        p_entitlement_active: true,
        p_entitlement_reason: "stripe_subscription_past_due_grace_period",
        p_paid_access_until: expect.any(String),
        p_stripe_status: "past_due",
      }),
    );
  });

  it("revokes past_due subscriptions after the grace period expires", async () => {
    mockConstructEvent.mockReturnValue(createEvent("customer.subscription.updated", { id: "sub_123" }));
    mockSubscriptionRetrieve.mockResolvedValueOnce(
      subscription({
        latest_invoice: {
          created: 1_744_502_400,
          id: "in_123",
        },
        status: "past_due",
      }),
    );

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_subscription_projection",
      expect.objectContaining({
        p_entitlement_active: false,
        p_entitlement_reason: "stripe_subscription_past_due_grace_expired",
        p_stripe_status: "past_due",
      }),
    );
  });

  it.each([
    ["unpaid", "stripe_subscription_unpaid"],
    ["canceled", "stripe_subscription_canceled"],
    ["paused", "stripe_subscription_paused"],
    ["incomplete", "stripe_subscription_incomplete"],
    ["incomplete_expired", "stripe_subscription_incomplete_expired"],
  ])("revokes paid access for %s subscriptions", async (status, reason) => {
    mockConstructEvent.mockReturnValue(createEvent("customer.subscription.updated", { id: "sub_123" }));
    mockSubscriptionRetrieve.mockResolvedValueOnce(subscription({ status }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_subscription_projection",
      expect.objectContaining({
        p_entitlement_active: false,
        p_entitlement_reason: reason,
        p_stripe_status: status,
      }),
    );
  });

  it("converges safely when the database skips an out-of-order subscription event", async () => {
    setupRpc({
      subscriptionProjection: {
        applied: false,
        entitlement_access_level: "pro",
        entitlement_reason: "out_of_order_subscription_event_skipped",
      },
    });
    mockConstructEvent.mockReturnValue(createEvent("customer.subscription.updated", { id: "sub_123" }));
    mockSubscriptionRetrieve.mockResolvedValueOnce(subscription({ status: "active" }));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
        headers: {
          "stripe-signature": "valid",
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "apply_subscription_projection",
      expect.objectContaining({
        p_entitlement_active: true,
      }),
    );
  });
});
