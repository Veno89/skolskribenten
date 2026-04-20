import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isActivePro } from "@/lib/billing/entitlements";
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
});

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

  if (!isActivePro(profile)) {
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
    .select("progress_map, teacher_notes, updated_at")
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
      state: {
        progressMap: (data.progress_map ?? {}) as ChecklistProgressMap,
        teacherNotes: data.teacher_notes ?? "",
        updatedAt: data.updated_at,
      },
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

  const { areaId, subjectId, progressMap, teacherNotes, updatedAt } = parsed.data;
  const incomingTimestamp = new Date(updatedAt).getTime();

  const { data: existingRow } = await context.supabase
    .from("planning_checklists")
    .select("progress_map, teacher_notes, updated_at")
    .eq("user_id", context.profile.id)
    .eq("subject_id", subjectId)
    .eq("area_id", areaId)
    .maybeSingle();

  if (existingRow) {
    const existingTimestamp = new Date(existingRow.updated_at).getTime();

    if (!Number.isNaN(existingTimestamp) && existingTimestamp > incomingTimestamp) {
      return NextResponse.json(
        {
          error: "Nyare version finns i cloudsync.",
          code: "CONFLICT_NEWER_SERVER_STATE",
          state: {
            progressMap: (existingRow.progress_map ?? {}) as ChecklistProgressMap,
            teacherNotes: existingRow.teacher_notes ?? "",
            updatedAt: existingRow.updated_at,
          },
          mergedState: {
            progressMap: mergeProgressMaps(
              (existingRow.progress_map ?? {}) as ChecklistProgressMap,
              progressMap,
            ),
            teacherNotes: mergeTeacherNotes(existingRow.teacher_notes ?? "", teacherNotes),
            updatedAt: existingRow.updated_at,
          },
        },
        { status: 409 },
      );
    }
  }

  const { error } = await context.supabase.from("planning_checklists").upsert(
    {
      user_id: context.profile.id,
      subject_id: subjectId,
      area_id: areaId,
      progress_map: progressMap as Json,
      teacher_notes: teacherNotes,
      updated_at: updatedAt,
    },
    { onConflict: "user_id,subject_id,area_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Kunde inte spara cloudsync" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
