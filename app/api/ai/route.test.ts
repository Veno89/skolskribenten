import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockDetectPotentialSensitiveContent = vi.fn();
const mockFormatPotentialSensitiveContentMessage = vi.fn();
const mockAnthropicStream = vi.fn();
const mockUsageInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

vi.mock("@/lib/gdpr/server-guard", () => ({
  detectPotentialSensitiveContent: mockDetectPotentialSensitiveContent,
  formatPotentialSensitiveContentMessage: mockFormatPotentialSensitiveContentMessage,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: mockAnthropicStream,
    },
  })),
}));

function buildAttemptResult(overrides: Record<string, unknown> = {}) {
  return {
    allowed: true,
    reason: "allowed",
    reserved_transform: false,
    subscription_end_date: null,
    subscription_status: "free",
    transforms_used_this_month: 0,
    user_settings: {},
    ...overrides,
  };
}

describe("/api/ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
        },
      },
    });

    mockDetectPotentialSensitiveContent.mockReturnValue([]);
    mockFormatPotentialSensitiveContentMessage.mockReturnValue("Känsligt innehåll upptäcktes.");
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "begin_generation_attempt") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: buildAttemptResult(),
            error: null,
          }),
        };
      }

      return {
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    mockUsageInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "usage_events") {
        return {
          insert: mockUsageInsert,
        };
      }

      return {
        insert: vi.fn(),
      };
    });

    mockAnthropicStream.mockResolvedValue(
      (async function* streamChunks() {
        yield {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "Första delen. ",
          },
        };

        yield {
          type: "content_block_delta",
          delta: {
            type: "text_delta",
            text: "Andra delen.",
          },
        };
      })(),
    );
  });

  it("rejects unauthenticated users", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { POST } = await import("@/app/api/ai/route");
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Du behöver logga in för att fortsätta.",
    });
  });

  it("rejects scrubbed input that still looks sensitive", async () => {
    mockDetectPotentialSensitiveContent.mockReturnValue(["namn"]);

    const { POST } = await import("@/app/api/ai/route");
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        body: JSON.stringify({
          templateType: "larlogg",
          scrubbedInput: "Det här underlaget innehåller fortfarande känsliga uppgifter.",
          scrubberStats: {
            namesReplaced: 0,
            piiTokensReplaced: 0,
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Känsligt innehåll upptäcktes.",
    });
  });

  it("returns a quota error when generation attempts are denied", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "begin_generation_attempt") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: buildAttemptResult({
              allowed: false,
              reason: "quota_exceeded",
              transforms_used_this_month: 10,
            }),
            error: null,
          }),
        };
      }

      return {
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const { POST } = await import("@/app/api/ai/route");
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        body: JSON.stringify({
          templateType: "larlogg",
          scrubbedInput: "Det här är ett tillräckligt långt och redan scrubbat underlag.",
          scrubberStats: {
            namesReplaced: 0,
            piiTokensReplaced: 0,
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "Månadens gräns är nådd",
      code: "QUOTA_EXCEEDED",
    });
  });

  it("streams generated content and records usage", async () => {
    const { POST } = await import("@/app/api/ai/route");
    const response = await POST(
      new Request("http://localhost/api/ai", {
        method: "POST",
        body: JSON.stringify({
          templateType: "lektionsplanering",
          scrubbedInput: "Det här är ett tillräckligt långt och redan scrubbat underlag.",
          scrubberStats: {
            namesReplaced: 1,
            piiTokensReplaced: 2,
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    await expect(response.text()).resolves.toBe("Första delen. Andra delen.");
    expect(mockAnthropicStream).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "begin_generation_attempt",
      expect.objectContaining({
        p_free_limit: 10,
        p_paid_limit: 100,
      }),
    );
    expect(mockUsageInsert).toHaveBeenCalledTimes(1);
    expect(mockUsageInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_type: "lektionsplanering",
        user_id: "user-123",
      }),
    );
  });
});
