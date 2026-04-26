import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockPortalSessionCreate = vi.fn();

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
    billingPortal: {
      sessions: {
        create: mockPortalSessionCreate,
      },
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

function setupPortalState({
  entitlement = {
    access_level: "free",
    paid_access_until: null,
    reason: "no_paid_entitlement",
    source: "none",
  },
  mapping = { stripe_customer_id: "cus_123" },
  profile,
}: {
  entitlement?: unknown;
  mapping?: unknown;
  profile: unknown;
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

    if (table === "stripe_customer_mappings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mapping,
              error: null,
            }),
          }),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("/api/stripe/portal", () => {
  const originalEnv = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.STRIPE_SECRET_KEY = "sk_test_portal";

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    mockPortalSessionCreate.mockResolvedValue({
      url: "https://stripe.test/portal",
    });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv.NEXT_PUBLIC_APP_URL;
    process.env.STRIPE_SECRET_KEY = originalEnv.STRIPE_SECRET_KEY;
  });

  it("rejects unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Du behÃ¶ver logga in fÃ¶r att fortsÃ¤tta.",
    });
  });

  it("rejects users without a recurring Pro subscription", async () => {
    setupPortalState({
      profile: {
        stripe_customer_id: "cus_123",
        subscription_status: "pro",
        subscription_end_date: null,
      },
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(400);
    expect(mockPortalSessionCreate).not.toHaveBeenCalled();
  });

  it("returns a billing portal URL only for the authenticated user's customer", async () => {
    setupPortalState({
      entitlement: {
        access_level: "pro",
        paid_access_until: null,
        reason: "stripe_subscription_active",
        source: "recurring_subscription",
      },
      profile: {
        stripe_customer_id: "cus_legacy",
        subscription_status: "free",
        subscription_end_date: null,
      },
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://stripe.test/portal",
    });
    expect(mockPortalSessionCreate).toHaveBeenCalledWith(
      {
        customer: "cus_123",
        return_url: "http://localhost:3000/konto",
      },
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^portal:user-123:/),
      }),
    );
  });

  it("returns a friendly error when portal creation fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    setupPortalState({
      entitlement: {
        access_level: "pro",
        paid_access_until: null,
        reason: "stripe_subscription_active",
        source: "recurring_subscription",
      },
      profile: {
        stripe_customer_id: "cus_123",
        subscription_status: "pro",
        subscription_end_date: null,
      },
    });
    mockPortalSessionCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Kunde inte Ã¶ppna kundportalen just nu. FÃ¶rsÃ¶k igen om en stund.",
    });

    consoleErrorSpy.mockRestore();
  });
});
