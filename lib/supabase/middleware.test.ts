import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

describe("updateSession", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: mockGetUser,
      },
    });
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey;
  });

  it("redirects unauthenticated users away from protected routes", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware");
    const response = await updateSession(
      new NextRequest("https://example.com/skrivstation?tab=utkast"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.com/logga-in?next=%2Fskrivstation%3Ftab%3Dutkast",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("redirects authenticated users away from auth routes", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const response = await updateSession(
      new NextRequest("https://example.com/logga-in?next=%2Fkonto"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/konto");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  });

  it("allows public routes through while still applying security headers", async () => {
    const { updateSession } = await import("@/lib/supabase/middleware");
    const response = await updateSession(new NextRequest("https://example.com/om-oss"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });
});
