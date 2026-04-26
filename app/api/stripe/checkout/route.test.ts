import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCheckoutSessionCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  }),
}));

vi.mock("@/lib/stripe/server", () => ({
  createStripeClient: () => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionCreate,
      },
    },
    customers: {
      create: mockCustomersCreate,
    },
  }),
}));

function createProfileSelectChain(profile: unknown) {
  return {
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: profile,
        error: null,
      }),
    }),
  };
}

function setupProfile(profile: unknown, entitlement: unknown = {
  access_level: "free",
  paid_access_until: null,
  reason: "no_paid_entitlement",
  source: "none",
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => createProfileSelectChain(profile)),
      };
    }

    if (table === "account_entitlements") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: entitlement,
              error: null,
            }),
          }),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "stripe_customer_mappings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        })),
      };
    }

    throw new Error(`Unexpected admin table: ${table}`);
  });
}

describe("/api/stripe/checkout", () => {
  const originalEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    STRIPE_PRICE_MONTHLY_PRO: process.env.STRIPE_PRICE_MONTHLY_PRO,
    STRIPE_PRICE_ONETIME_30DAY: process.env.STRIPE_PRICE_ONETIME_30DAY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.STRIPE_SECRET_KEY = "sk_test_checkout";
    process.env.STRIPE_PRICE_MONTHLY_PRO = "price_monthly";
    process.env.STRIPE_PRICE_ONETIME_30DAY = "price_onetime";

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "larare@skola.se",
        },
      },
    });

    mockCustomersCreate.mockResolvedValue({
      id: "cus_new",
    });

    mockCheckoutSessionCreate.mockResolvedValue({
      id: "cs_test_123",
      livemode: false,
      payment_status: "unpaid",
      status: "open",
      url: "https://stripe.test/checkout",
    });

    mockAdminRpc.mockImplementation((fnName: string, args: Record<string, unknown>) => {
      if (fnName === "record_stripe_customer_mapping") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              livemode: args.p_livemode,
              stripe_customer_id: args.p_stripe_customer_id,
              user_id: args.p_user_id,
            },
            error: null,
          }),
        };
      }

      if (fnName === "record_checkout_session_created") {
        return { error: null };
      }

      throw new Error(`Unexpected rpc: ${fnName}`);
    });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    process.env.STRIPE_SECRET_KEY = originalEnv.STRIPE_SECRET_KEY;
    process.env.STRIPE_PRICE_MONTHLY_PRO = originalEnv.STRIPE_PRICE_MONTHLY_PRO;
    process.env.STRIPE_PRICE_ONETIME_30DAY = originalEnv.STRIPE_PRICE_ONETIME_30DAY;
  });

  it("rejects unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Du behÃ¶ver logga in fÃ¶r att fortsÃ¤tta.",
    });
  });

  it("rejects client-supplied price IDs and unknown price keys", async () => {
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: "cus_existing",
      subscription_end_date: null,
      subscription_status: "free",
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: "price_attacker", priceType: "enterprise" }),
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled();
  });

  it("prevents duplicate checkout for users with active Pro", async () => {
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: "cus_existing",
      subscription_status: "pro",
      subscription_end_date: null,
    }, {
      access_level: "pro",
      paid_access_until: null,
      reason: "stripe_subscription_active",
      source: "recurring_subscription",
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(409);
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled();
  });

  it("does not trust a stale profile projection when authoritative entitlement is free", async () => {
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: "cus_existing",
      subscription_status: "pro",
      subscription_end_date: null,
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockCheckoutSessionCreate).toHaveBeenCalled();
  });

  it("creates one canonical Stripe customer mapping and a server-owned checkout session", async () => {
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: null,
      subscription_status: "free",
      subscription_end_date: null,
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "onetime" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://stripe.test/checkout",
    });
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      {
        email: "larare@skola.se",
        metadata: { supabase_user_id: "user-123" },
      },
      {
        idempotencyKey: "customer:user:user-123",
      },
    );
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "record_stripe_customer_mapping",
      expect.objectContaining({
        p_stripe_customer_id: "cus_new",
        p_user_id: "user-123",
      }),
    );
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user-123",
        customer: "cus_new",
        line_items: [{ price: "price_onetime", quantity: 1 }],
        mode: "payment",
        payment_method_types: ["card", "swish"],
        metadata: {
          price_key: "onetime",
          supabase_user_id: "user-123",
        },
        payment_intent_data: {
          metadata: {
            price_key: "onetime",
            supabase_user_id: "user-123",
          },
        },
        success_url: "http://localhost:3000/konto?payment=success&session_id={CHECKOUT_SESSION_ID}",
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^checkout:user-123:onetime:/),
      }),
    );
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "record_checkout_session_created",
      expect.objectContaining({
        p_stripe_checkout_session_id: "cs_test_123",
        p_stripe_price_id: "price_onetime",
      }),
    );
  });

  it("limits recurring checkout to approved monthly card payments", async () => {
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: "cus_existing",
      subscription_status: "free",
      subscription_end_date: null,
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        line_items: [{ price: "price_monthly", quantity: 1 }],
        mode: "subscription",
        payment_method_types: ["card"],
        subscription_data: {
          metadata: {
            price_key: "monthly",
            supabase_user_id: "user-123",
          },
        },
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^checkout:user-123:monthly:/),
      }),
    );
  });

  it("fails safely when required Stripe config is missing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.STRIPE_PRICE_MONTHLY_PRO = "";
    setupProfile({
      email: "larare@skola.se",
      stripe_customer_id: "cus_existing",
      subscription_status: "free",
      subscription_end_date: null,
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(500);
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
