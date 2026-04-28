import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const originalAppEnv = process.env.APP_ENV;
const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;

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
    vi.unstubAllGlobals();
    process.env.APP_ENV = "test";
    delete process.env.TURNSTILE_SECRET_KEY;

    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    mockInsert.mockResolvedValue({ error: null });
    mockGte.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ gte: mockGte });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelect,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }

    if (originalTurnstileSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
    }
  });

  it("stores a support request and returns success", async () => {
    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "Larare@Skola.se",
          message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
          name: "Anna Andersson",
          role: "Klasslärare",
          topic: "Tekniskt problem",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg.",
    });
    expect(mockFrom).toHaveBeenCalledWith("support_requests");
    expect(mockInsert).toHaveBeenCalledWith({
      email: "larare@skola.se",
      message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
      name: "Anna Andersson",
      request_id: expect.any(String),
      role: "Klasslärare",
      status: "new",
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
    expect(response.headers.get("x-request-id")).toBeTruthy();
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

    const response = await POST(
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

    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(mockInsert).toHaveBeenCalledWith({
      email: "larare@skola.se",
      message: "Jag undrar hur cloudsync fungerar för planering.",
      name: "Anna Andersson",
      request_id: expect.any(String),
      role: null,
      status: "new",
      topic: "Allmän fråga",
      user_id: "user-123",
    });
  });

  it("verifies Turnstile when bot protection is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          captchaToken: "turnstile-token-123",
          email: "larare@skola.se",
          message: "Jag undrar hur supportflödet fungerar för piloten.",
          name: "Anna Andersson",
          role: "",
          topic: "Allmän fråga",
        }),
        headers: {
          "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        },
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        body: expect.any(FormData),
        method: "POST",
      }),
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("rejects support requests when Turnstile verification fails", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );

    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          captchaToken: "turnstile-token-123",
          email: "larare@skola.se",
          message: "Jag undrar hur supportflödet fungerar för piloten.",
          name: "Anna Andersson",
          role: "",
          topic: "Allmän fråga",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Bot-skyddet kunde inte verifieras. Försök igen.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects support messages that still contain obvious personal data", async () => {
    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Eleven Anna har personnummer 20120101-1234 och jag behÃ¶ver support.",
          name: "LÃ¤rare Test",
          role: "KlasslÃ¤rare",
          topic: "Tekniskt problem",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("personuppgifter"),
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("silently accepts honeypot submissions without storing them", async () => {
    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
          name: "Anna Andersson",
          role: "Klasslärare",
          topic: "Tekniskt problem",
          website: "https://spam.example.com",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns a rate-limit message when too many recent requests exist", async () => {
    mockGte.mockResolvedValue({
      data: [
        { created_at: "2026-04-23T10:00:00.000Z", message: "Första meddelandet." },
        { created_at: "2026-04-23T10:05:00.000Z", message: "Andra meddelandet." },
        { created_at: "2026-04-23T10:10:00.000Z", message: "Tredje meddelandet." },
      ],
      error: null,
    });

    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "Jag har ytterligare en fråga om supportflödet.",
          name: "Anna Andersson",
          role: "Klasslärare",
          topic: "Allmän fråga",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Du har skickat flera meddelanden på kort tid. Vänta gärna en stund innan du försöker igen.",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("suppresses duplicate submissions instead of storing them twice", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mockGte.mockResolvedValue({
      data: [
        {
          created_at: new Date().toISOString(),
          message: "Jag behöver hjälp med ett tekniskt problem i skrivstationen.",
        },
      ],
      error: null,
    });

    const { POST } = await import("@/app/api/support/route");

    const response = await POST(
      new Request("http://localhost/api/support", {
        body: JSON.stringify({
          email: "larare@skola.se",
          message: "  Jag behöver hjälp med ett tekniskt problem i skrivstationen.  ",
          name: "Anna Andersson",
          role: "Klasslärare",
          topic: "Tekniskt problem",
        }),
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg.",
    });
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("Suppressed duplicate support submission."),
      expect.objectContaining({
        emailHash: expect.any(String),
      }),
    );
    expect(infoSpy.mock.calls[0]?.[1]).not.toHaveProperty("email");
    expect(mockInsert).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});
