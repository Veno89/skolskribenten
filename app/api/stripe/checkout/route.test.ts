import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
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

describe("/api/stripe/checkout", () => {
  const originalMonthlyPrice = process.env.STRIPE_PRICE_MONTHLY_PRO;
  const originalOneTimePrice = process.env.STRIPE_PRICE_ONETIME_30DAY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_MONTHLY_PRO = "price-monthly";
    process.env.STRIPE_PRICE_ONETIME_30DAY = "price-onetime";

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
      url: "https://stripe.test/checkout",
    });
  });

  afterAll(() => {
    process.env.STRIPE_PRICE_MONTHLY_PRO = originalMonthlyPrice;
    process.env.STRIPE_PRICE_ONETIME_30DAY = originalOneTimePrice;
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
      error: "Du behöver logga in för att fortsätta.",
    });
  });

  it("prevents duplicate checkout for users with active Pro", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              email: "larare@skola.se",
              stripe_customer_id: "cus_existing",
              subscription_status: "pro",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Du har redan en aktiv Pro-plan på kontot.",
    });
    expect(mockCheckoutSessionCreate).not.toHaveBeenCalled();
  });

  it("creates a new Stripe customer when needed and returns a checkout URL", async () => {
    const mockProfileUpdateEq = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              email: "larare@skola.se",
              stripe_customer_id: null,
              subscription_status: "free",
              subscription_end_date: null,
            })),
          update: vi.fn(() => ({
            eq: mockProfileUpdateEq,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "onetime" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      url: "https://stripe.test/checkout",
    });
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: "larare@skola.se",
      metadata: { supabase_user_id: "user-123" },
    });
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        mode: "payment",
        payment_method_types: ["card", "swish"],
        metadata: {
          supabase_user_id: "user-123",
          price_type: "onetime",
        },
        payment_intent_data: {
          metadata: {
            supabase_user_id: "user-123",
            price_type: "onetime",
          },
        },
      }),
    );
    expect(mockProfileUpdateEq).toHaveBeenCalledWith("id", "user-123");
  });

  it("limits recurring checkout to card payments", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              email: "larare@skola.se",
              stripe_customer_id: "cus_existing",
              subscription_status: "free",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      url: "https://stripe.test/checkout",
    });
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "subscription",
        payment_method_types: ["card"],
        metadata: {
          supabase_user_id: "user-123",
          price_type: "monthly",
        },
      }),
    );
    expect(mockCheckoutSessionCreate.mock.calls[0]?.[0]).not.toHaveProperty("payment_intent_data");
  });

  it("returns a friendly error when Stripe checkout session creation fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              email: "larare@skola.se",
              stripe_customer_id: "cus_existing",
              subscription_status: "free",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mockCheckoutSessionCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceType: "monthly" }),
      }) as never,
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Kunde inte starta betalningen just nu. Försök igen om en stund.",
    });

    consoleErrorSpy.mockRestore();
  });
});
