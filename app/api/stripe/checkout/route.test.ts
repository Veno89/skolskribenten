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
        metadata: {
          supabase_user_id: "user-123",
          price_type: "onetime",
        },
      }),
    );
    expect(mockProfileUpdateEq).toHaveBeenCalledWith("id", "user-123");
  });
});
