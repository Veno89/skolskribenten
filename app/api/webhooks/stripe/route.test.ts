import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.fn();
const mockCustomerRetrieve = vi.fn();
const mockFrom = vi.fn();
const mockUpdateEq = vi.fn();

vi.mock("@/lib/stripe/server", () => ({
  createStripeClient: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    customers: {
      retrieve: mockCustomerRetrieve,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

function createProfilesTable(existingProfile: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: existingProfile,
        }),
      }),
    })),
    update: vi.fn(() => ({
      eq: mockUpdateEq,
    })),
  };
}

describe("/api/webhooks/stripe", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    mockUpdateEq.mockResolvedValue({ error: null });
    mockCustomerRetrieve.mockResolvedValue({
      metadata: {
        supabase_user_id: "user-123",
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return createProfilesTable({
          subscription_status: "pro",
          subscription_end_date: "2026-06-01T00:00:00.000Z",
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
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
  });

  it("skips duplicate one-time checkout events that would extend an existing pass", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      created: 1_745_193_600,
      data: {
        object: {
          metadata: {
            supabase_user_id: "user-123",
            price_type: "onetime",
          },
        },
      },
    });

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
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it("downgrades users after repeated payment failures", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          customer: "cus_123",
          id: "in_123",
          attempt_count: 3,
        },
      },
    });

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
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mockCustomerRetrieve).toHaveBeenCalledWith("cus_123");
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "user-123");
  });
});
