import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

function createSelectChain(result: { data: unknown; error?: unknown }) {
  const chain: {
    eq: (column: string, value: string) => typeof chain;
    maybeSingle: () => Promise<{ data: unknown; error: unknown | null }>;
  } = {
    eq: () => chain,
    maybeSingle: async () => ({
      data: result.data,
      error: result.error ?? null,
    }),
  };

  return chain;
}

describe("/api/planning/checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    mockUpsert.mockResolvedValue({ error: null });
  });

  it("rejects unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { GET } = await import("@/app/api/planning/checklist/route");
    const response = await GET(
      new NextRequest("http://localhost/api/planning/checklist?subjectId=historia&areaId=test"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Inte inloggad",
    });
  });

  it("returns stored cloud state for active Pro users", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: "user-123",
                subscription_status: "pro",
                subscription_end_date: null,
              },
            })),
        };
      }

      if (table === "account_entitlements") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                access_level: "pro",
                paid_access_until: null,
                reason: "stripe_subscription_active",
                source: "recurring_subscription",
              },
            })),
        };
      }

      if (table === "planning_checklists") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                progress_map: {
                  item1: "done",
                },
                teacher_notes: "Fokusera på källkritik nästa vecka.",
                updated_at: "2026-04-20T10:00:00.000Z",
              },
            })),
          upsert: mockUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { GET } = await import("@/app/api/planning/checklist/route");
    const response = await GET(
      new NextRequest(
        "http://localhost/api/planning/checklist?subjectId=historia&areaId=industriella-revolutionen",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      state: {
        progressMap: {
          item1: "done",
        },
        teacherNotes: "Fokusera på källkritik nästa vecka.",
        updatedAt: "2026-04-20T10:00:00.000Z",
      },
    });
  });

  it("blocks non-Pro users from using cloud sync", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: "user-123",
                subscription_status: "free",
                subscription_end_date: null,
              },
            })),
        };
      }

      if (table === "account_entitlements") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                access_level: "free",
                paid_access_until: null,
                reason: "no_paid_entitlement",
                source: "none",
              },
            })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/planning/checklist/route");
    const response = await POST(
      new Request("http://localhost/api/planning/checklist", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "historia",
          areaId: "industriella-revolutionen",
          progressMap: {
            item1: "done",
          },
          teacherNotes: "Planerar uppföljning.",
          updatedAt: "2026-04-20T10:00:00.000Z",
        }),
      }) as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cloudsync kräver Pro",
      code: "PRO_REQUIRED",
    });
  });

  it("returns a conflict payload when the server has a newer version", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: "user-123",
                subscription_status: "pro",
                subscription_end_date: null,
              },
            })),
        };
      }

      if (table === "account_entitlements") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                access_level: "pro",
                paid_access_until: null,
                reason: "stripe_subscription_active",
                source: "recurring_subscription",
              },
            })),
        };
      }

      if (table === "planning_checklists") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                progress_map: {
                  item1: "done",
                  item2: "in_progress",
                },
                teacher_notes: "Servernotering",
                updated_at: "2026-04-20T12:00:00.000Z",
              },
            })),
          upsert: mockUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/planning/checklist/route");
    const response = await POST(
      new Request("http://localhost/api/planning/checklist", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "historia",
          areaId: "industriella-revolutionen",
          progressMap: {
            item1: "in_progress",
            item2: "not_started",
          },
          teacherNotes: "Lokal notering",
          updatedAt: "2026-04-20T10:00:00.000Z",
        }),
      }) as never,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Nyare version finns i cloudsync.",
      code: "CONFLICT_NEWER_SERVER_STATE",
      state: {
        progressMap: {
          item1: "done",
          item2: "in_progress",
        },
        teacherNotes: "Servernotering",
        updatedAt: "2026-04-20T12:00:00.000Z",
      },
      mergedState: {
        progressMap: {
          item1: "done",
          item2: "in_progress",
        },
        teacherNotes: "Servernotering\n\n---\n\nLokal notering",
        updatedAt: "2026-04-20T12:00:00.000Z",
      },
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts planning state when the incoming version is current", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: "user-123",
                subscription_status: "pro",
                subscription_end_date: null,
              },
            })),
        };
      }

      if (table === "account_entitlements") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                access_level: "pro",
                paid_access_until: null,
                reason: "stripe_subscription_active",
                source: "recurring_subscription",
              },
            })),
        };
      }

      if (table === "planning_checklists") {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: null,
            })),
          upsert: mockUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { POST } = await import("@/app/api/planning/checklist/route");
    const response = await POST(
      new Request("http://localhost/api/planning/checklist", {
        method: "POST",
        body: JSON.stringify({
          subjectId: "historia",
          areaId: "industriella-revolutionen",
          progressMap: {
            item1: "done",
          },
          teacherNotes: "Planerar uppföljning.",
          updatedAt: "2026-04-20T10:00:00.000Z",
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        subject_id: "historia",
        area_id: "industriella-revolutionen",
        progress_map: {
          item1: "done",
        },
        teacher_notes: "Planerar uppföljning.",
        updated_at: "2026-04-20T10:00:00.000Z",
      },
      { onConflict: "user_id,subject_id,area_id" },
    );
  });
});
