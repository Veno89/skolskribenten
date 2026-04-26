import { createClient } from "@supabase/supabase-js";

const repair = process.argv.includes("--repair");
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const retentionDays = Number(daysArg?.split("=")[1] ?? 90);
const limit = Number(limitArg?.split("=")[1] ?? 500);
const now = new Date();
const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAdminKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

assertPositiveInteger(retentionDays, "--days");
assertPositiveInteger(limit, "--limit");

const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAdminKey = getAdminKey();

if (!supabaseAdminKey) {
  throw new Error("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, supabaseAdminKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { data: candidates, error } = await supabase
  .from("support_requests")
  .select("id, request_id, status, created_at, handled_at, last_status_at")
  .in("status", ["resolved", "spam"])
  .is("deleted_at", null)
  .lt("last_status_at", cutoff)
  .order("last_status_at", { ascending: true })
  .limit(limit);

if (error) {
  throw new Error(`Failed to load support retention candidates: ${error.message}`);
}

console.log(JSON.stringify({
  candidateCount: candidates?.length ?? 0,
  cutoff,
  mode: repair ? "repair" : "dry-run",
  retentionDays,
}));

for (const candidate of candidates ?? []) {
  const summary = {
    action: repair ? "soft_delete_support_request" : "would_soft_delete_support_request",
    createdAt: candidate.created_at,
    handledAt: candidate.handled_at,
    lastStatusAt: candidate.last_status_at,
    requestId: candidate.request_id ?? candidate.id,
    status: candidate.status,
  };

  console.log(JSON.stringify(summary));

  if (!repair) {
    continue;
  }

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("support_requests")
    .update({
      deleted_at: deletedAt,
      email: "deleted@support.skolskribenten.local",
      handled_at: deletedAt,
      message: "[deleted by support retention job]",
      name: "[deleted by support retention job]",
      redacted_at: deletedAt,
      role: null,
      status: "deleted",
    })
    .eq("id", candidate.id);

  if (updateError) {
    console.error(JSON.stringify({
      error: updateError.message,
      requestId: candidate.request_id ?? candidate.id,
    }));
    process.exitCode = 1;
  }
}
