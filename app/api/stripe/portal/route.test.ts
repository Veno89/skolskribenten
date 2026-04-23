import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/supabase/config", () => ({
  getAppUrl: () => "http://localhost:3000",
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

describe("/api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
      error: "Du behöver logga in för att fortsätta.",
    });
  });

  it("rejects users without a recurring Pro subscription", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              stripe_customer_id: "cus_123",
              subscription_status: "free",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Det finns inget månadsabonnemang att hantera just nu.",
    });
  });

  it("returns a billing portal URL for recurring Pro users", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              stripe_customer_id: "cus_123",
              subscription_status: "pro",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      url: "https://stripe.test/portal",
    });
    expect(mockPortalSessionCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://localhost:3000/konto",
    });
  });

  it("returns a friendly error when portal creation fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createProfileSelectChain({
              stripe_customer_id: "cus_123",
              subscription_status: "pro",
              subscription_end_date: null,
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mockPortalSessionCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const { POST } = await import("@/app/api/stripe/portal/route");
    const response = await POST(new Request("http://localhost/api/stripe/portal", { method: "POST" }) as never);

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Kunde inte öppna kundportalen just nu. Försök igen om en stund.",
    });

    consoleErrorSpy.mockRestore();
  });
});
