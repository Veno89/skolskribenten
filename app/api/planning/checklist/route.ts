import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthoritativeEntitlementDecision } from "@/lib/billing/entitlements";
import { mergeProgressMaps, mergeTeacherNotes } from "@/lib/planning/cloud-merge";
import { createClient } from "@/lib/supabase/server";
import type { ChecklistProgressMap } from "@/lib/planning/gap-analysis";
import type { Json } from "@/types/database";

const QuerySchema = z.object({
  subjectId: z.string().min(1).max(120),
  areaId: z.string().min(1).max(120),
});

const UpsertSchema = z.object({
  subjectId: z.string().min(1).max(120),
  areaId: z.string().min(1).max(120),
  progressMap: z.record(z.string(), z.enum(["done", "in_progress", "not_started"])),
  teacherNotes: z.string().max(5000),
  updatedAt: z.string().datetime(),
  baseRevision: z.number().int().min(0).nullable().optional(),
  resolvedConflictId: z.string().uuid().nullable().optional(),
  resolutionStrategy: z.enum(["server", "merged", "local"]).nullable().optional(),
});

interface PlanningChecklistCloudState {
  progressMap: ChecklistProgressMap;
  revision: number | null;
  serverUpdatedAt?: string;
  teacherNotes: string;
  updatedAt: string;
}

function toCloudState(data: {
  client_updated_at?: string | null;
  progress_map: Json | null;
  revision?: number | null;
  teacher_notes: string | null;
  updated_at: string;
}): PlanningChecklistCloudState {
  return {
    progressMap: (data.progress_map ?? {}) as ChecklistProgressMap,
    revision: data.revision ?? null,
    serverUpdatedAt: data.updated_at,
    teacherNotes: data.teacher_notes ?? "",
    updatedAt: data.client_updated_at ?? data.updated_at,
  };
}

type AuthContext =
  | {
      profile: {
        id: string;
        subscription_end_date: string | null;
        subscription_status: "free" | "pro" | "cancelled";
      };
      supabase: ReturnType<typeof createClient>;
    }
  | {
      error: Response;
    };

async function getAuthenticatedProfile(): Promise<AuthContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Inte inloggad" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, subscription_status, subscription_end_date")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: NextResponse.json({ error: "Profil saknas" }, { status: 404 }) };
  }

  const { data: entitlement, error: entitlementError } = await supabase
    .from("account_entitlements")
    .select("access_level, source, reason, paid_access_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (entitlementError) {
    return {
      error: NextResponse.json(
        { error: "Kunde inte kontrollera Pro-status" },
        { status: 500 },
      ),
    };
  }

  if (!getAuthoritativeEntitlementDecision(entitlement).active) {
    return {
      error: NextResponse.json(
        { error: "Cloudsync kräver Pro", code: "PRO_REQUIRED" },
        { status: 403 },
      ),
    };
  }

  return { profile, supabase };
}

export async function GET(req: NextRequest): Promise<Response> {
  const parsed = QuerySchema.safeParse({
    subjectId: req.nextUrl.searchParams.get("subjectId"),
    areaId: req.nextUrl.searchParams.get("areaId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const context = await getAuthenticatedProfile();
  if ("error" in context) {
    return context.error;
  }

  const { areaId, subjectId } = parsed.data;

  const { data, error } = await context.supabase
    .from("planning_checklists")
    .select("progress_map, teacher_notes, updated_at, client_updated_at, revision")
    .eq("user_id", context.profile.id)
    .eq("subject_id", subjectId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Kunde inte läsa cloudsync" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ state: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      state: toCloudState(data),
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  const parsed = UpsertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig payload" }, { status: 400 });
  }

  const context = await getAuthenticatedProfile();
  if ("error" in context) {
    return context.error;
  }

  const {
    areaId,
    baseRevision,
    progressMap,
    resolvedConflictId,
    resolutionStrategy,
    subjectId,
    teacherNotes,
    updatedAt,
  } = parsed.data;

  const { data, error } = await context.supabase.rpc("save_planning_checklist_revisioned", {
    p_area_id: areaId,
    p_base_revision: baseRevision ?? null,
    p_client_updated_at: updatedAt,
    p_progress_map: progressMap as Json,
    p_resolution_strategy: resolutionStrategy ?? null,
    p_resolved_conflict_id: resolvedConflictId ?? null,
    p_subject_id: subjectId,
    p_teacher_notes: teacherNotes,
  });

  if (error) {
    return NextResponse.json({ error: "Kunde inte spara cloudsync" }, { status: 500 });
  }

  const result = data?.[0];

  if (!result) {
    return NextResponse.json({ error: "Kunde inte spara cloudsync" }, { status: 500 });
  }

  const state = toCloudState(result);

  if (!result.applied) {
    return NextResponse.json(
      {
        error: "Nyare version finns i cloudsync.",
        code: "CONFLICT_STALE_PLANNING_REVISION",
        conflictId: result.conflict_id,
        state,
        mergedState: {
          progressMap: mergeProgressMaps(state.progressMap, progressMap),
          revision: state.revision,
          serverUpdatedAt: state.serverUpdatedAt,
          teacherNotes: mergeTeacherNotes(state.teacherNotes, teacherNotes),
          updatedAt: state.updatedAt,
        },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, state }, { status: 200 });
}
