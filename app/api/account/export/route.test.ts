import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

function buildTableQuery(table: string) {
  const tableData: Record<string, unknown> = {
    account_deletion_requests: [],
    account_entitlements: [],
    planning_checklists: [],
    profiles: {
      email: "teacher@example.se",
      id: "user-123",
    },
    stripe_checkout_sessions: [],
    stripe_customer_mappings: [],
    stripe_subscriptions: [],
    support_requests: [],
    usage_events: [],
  };

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => {
        if (table === "profiles") {
          return {
            maybeSingle: vi.fn().mockResolvedValue({
              data: tableData.profiles,
              error: null,
            }),
          };
        }

        return Promise.resolve({
          data: tableData[table] ?? [],
          error: null,
        });
      }),
    })),
  };
}

describe("/api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email: "teacher@example.se",
          id: "user-123",
        },
      },
    });
    mockFrom.mockImplementation(buildTableQuery);
  });

  it("rejects unauthenticated account exports", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { GET } = await import("@/app/api/account/export/route");
    const response = await GET(new Request("http://localhost/api/account/export") as never);

    expect(response.status).toBe(401);
  });

  it("returns an authenticated JSON account export without caching", async () => {
    const { GET } = await import("@/app/api/account/export/route");
    const response = await GET(new Request("http://localhost/api/account/export") as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("skolskribenten-account-export-user-123");

    const payload = await response.json();
    expect(payload).toMatchObject({
      exportFormatVersion: "skolskribenten-account-export-2026-04-27-v1",
      profile: {
        id: "user-123",
      },
      userId: "user-123",
    });
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockFrom).toHaveBeenCalledWith("usage_events");
  });
});
