import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

describe("middleware entrypoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSession.mockResolvedValue(NextResponse.next());
  });

  it("delegates requests to updateSession", async () => {
    const { middleware } = await import("../../../middleware");
    const request = new NextRequest("https://example.com/skrivstation");

    await middleware(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
  });
});
