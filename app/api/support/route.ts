import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SupportRequestSchema } from "@/lib/support/schema";

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const parsed = SupportRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ogiltig förfrågan." }, { status: 400 });
  }

  let userId: string | null = null;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from("support_requests").insert({
      email: parsed.data.email,
      message: parsed.data.message,
      name: parsed.data.name,
      role: parsed.data.role ?? null,
      topic: parsed.data.topic,
      user_id: userId,
    });

    if (error) {
      console.error("[Support Route] Failed to store support request:", error.message);
      return NextResponse.json(
        { error: "Vi kunde inte ta emot meddelandet just nu. Försök igen om en stund." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[Support Route] Failed to create support request:", error);
    return NextResponse.json(
      { error: "Vi kunde inte ta emot meddelandet just nu. Försök igen om en stund." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, message: "Tack. Ditt meddelande är mottaget och ligger nu i vår supportinkorg." },
    { status: 200 },
  );
}
