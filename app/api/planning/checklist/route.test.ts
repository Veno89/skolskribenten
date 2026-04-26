import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
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
    mockRpc.mockResolvedValue({ data: [], error: null });
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
                client_updated_at: "2026-04-20T09:30:00.000Z",
                revision: 4,
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
        updatedAt: "2026-04-20T09:30:00.000Z",
        serverUpdatedAt: "2026-04-20T10:00:00.000Z",
        revision: 4,
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
          baseRevision: null,
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

      throw new Error(`Unexpected table: ${table}`);
    });
    mockRpc.mockResolvedValue({
      data: [
        {
          applied: false,
          conflict_id: "11111111-1111-4111-8111-111111111111",
          progress_map: {
            item1: "done",
            item2: "in_progress",
          },
          teacher_notes: "Servernotering",
          updated_at: "2026-04-20T12:00:00.000Z",
          client_updated_at: "2026-04-20T11:30:00.000Z",
          revision: 3,
        },
      ],
      error: null,
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
          baseRevision: 2,
        }),
      }) as never,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Nyare version finns i cloudsync.",
      code: "CONFLICT_STALE_PLANNING_REVISION",
      conflictId: "11111111-1111-4111-8111-111111111111",
      state: {
        progressMap: {
          item1: "done",
          item2: "in_progress",
        },
        revision: 3,
        serverUpdatedAt: "2026-04-20T12:00:00.000Z",
        teacherNotes: "Servernotering",
        updatedAt: "2026-04-20T11:30:00.000Z",
      },
      mergedState: {
        progressMap: {
          item1: "done",
          item2: "in_progress",
        },
        revision: 3,
        serverUpdatedAt: "2026-04-20T12:00:00.000Z",
        teacherNotes: "Servernotering\n\n---\n\nLokal notering",
        updatedAt: "2026-04-20T11:30:00.000Z",
      },
    });
    expect(mockRpc).toHaveBeenCalledWith("save_planning_checklist_revisioned", {
      p_area_id: "industriella-revolutionen",
      p_base_revision: 2,
      p_client_updated_at: "2026-04-20T10:00:00.000Z",
      p_progress_map: {
        item1: "in_progress",
        item2: "not_started",
      },
      p_resolution_strategy: null,
      p_resolved_conflict_id: null,
      p_subject_id: "historia",
      p_teacher_notes: "Lokal notering",
    });
  });

  it("saves planning state when the incoming base revision is current", async () => {
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

      throw new Error(`Unexpected table: ${table}`);
    });
    mockRpc.mockResolvedValue({
      data: [
        {
          applied: true,
          conflict_id: null,
          progress_map: {
            item1: "done",
          },
          teacher_notes: "Planerar uppföljning.",
          updated_at: "2026-04-20T10:00:05.000Z",
          client_updated_at: "2026-04-20T10:00:00.000Z",
          revision: 1,
        },
      ],
      error: null,
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
          baseRevision: null,
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.state).toMatchObject({
      progressMap: {
        item1: "done",
      },
      revision: 1,
      serverUpdatedAt: "2026-04-20T10:00:05.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z",
    });
    expect(mockRpc).toHaveBeenCalledWith("save_planning_checklist_revisioned", {
      p_area_id: "industriella-revolutionen",
      p_base_revision: null,
      p_client_updated_at: "2026-04-20T10:00:00.000Z",
      p_progress_map: {
        item1: "done",
      },
      p_resolution_strategy: null,
      p_resolved_conflict_id: null,
      p_subject_id: "historia",
      p_teacher_notes: "Planerar uppföljning.",
    });
  });
});
