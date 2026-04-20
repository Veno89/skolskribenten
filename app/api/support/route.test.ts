import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();

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

describe("/api/support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
  });

  it("stores a support request and returns success", async () => {
    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
          name: "Anna Andersson",
          role: "Klasslärare",
          topic: "Tekniskt problem",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg.",
    });
    expect(mockFrom).toHaveBeenCalledWith("support_requests");
    expect(mockInsert).toHaveBeenCalledWith({
      email: "larare@skola.se",
      message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
      name: "Anna Andersson",
      role: "Klasslärare",
      topic: "Tekniskt problem",
      user_id: null,
    });
  });

  it("returns validation errors for invalid payloads", async () => {
    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Det här meddelandet är tillräckligt långt för valideringen.",
          name: "",
          topic: "Allmän fråga",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ange ditt namn.",
    });
  });

  it("associates the support request with the logged-in user when available", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    const { POST } = await import("@/app/api/support/route");

    await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Jag undrar hur cloudsync fungerar för planering.",
          name: "Anna Andersson",
          role: "",
          topic: "Allmän fråga",
        }),
        method: "POST",
      }) as never,
    );

    expect(mockInsert).toHaveBeenCalledWith({
      email: "larare@skola.se",
      message: "Jag undrar hur cloudsync fungerar för planering.",
      name: "Anna Andersson",
      role: null,
      topic: "Allmän fråga",
      user_id: "user-123",
    });
  });
});
