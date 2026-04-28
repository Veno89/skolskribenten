"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildPath } from "@/lib/auth/redirects";
import {
  isCurrentServerActionOriginValid,
  SERVER_ACTION_ORIGIN_ERROR_MESSAGE,
} from "@/lib/security/server-action-origin";
import {
  SupportRequestActionSchema,
  SupportStatusActionSchema,
  buildSupportRequestRedactionUpdate,
  buildSupportRequestSoftDeletionUpdate,
  buildSupportRequestStatusUpdate,
} from "@/lib/support/admin";
import { getSupportAdminContext } from "@/lib/support/admin-server";

const SUPPORT_ADMIN_PATH = "/admin/support";

function redirectToSupportQueue(params: {
  error?: string;
  statusFilter?: string;
  success?: string;
}): never {
  redirect(
    buildPath(SUPPORT_ADMIN_PATH, {
      error: params.error,
      status: params.statusFilter ?? "open",
      success: params.success,
    }),
  );
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function rejectInvalidSupportOrigin(statusFilter: string | undefined): void {
  if (!isCurrentServerActionOriginValid()) {
    redirectToSupportQueue({
      error: SERVER_ACTION_ORIGIN_ERROR_MESSAGE,
      statusFilter,
    });
  }
}

async function requireSupportAdmin(statusFilter: string | undefined) {
  const context = await getSupportAdminContext(SUPPORT_ADMIN_PATH);

  if (!context) {
    redirectToSupportQueue({
      error: "Du saknar behörighet att hantera supportärenden.",
      statusFilter,
    });
  }

  return context;
}

function logSupportAdminAction(
  message: string,
  details: Record<string, boolean | number | string | null>,
): void {
  console.info(`[SupportAdmin] ${message}`, details);
}

export async function updateSupportRequestStatusAction(formData: FormData): Promise<void> {
  const statusFilter = getFormString(formData, "statusFilter");
  rejectInvalidSupportOrigin(statusFilter);

  const parsed = SupportStatusActionSchema.safeParse({
    requestId: getFormString(formData, "requestId"),
    status: getFormString(formData, "status"),
    statusFilter,
  });

  if (!parsed.success) {
    redirectToSupportQueue({
      error: "Kunde inte uppdatera ärendet. Kontrollera statusvalet.",
      statusFilter,
    });
  }

  const context = await requireSupportAdmin(parsed.data.statusFilter);
  const now = new Date().toISOString();
  const { error } = await context.adminSupabase
    .from("support_requests")
    .update(buildSupportRequestStatusUpdate(parsed.data.status, now))
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectToSupportQueue({
      error: "Kunde inte uppdatera supportärendet just nu.",
      statusFilter: parsed.data.statusFilter,
    });
  }

  logSupportAdminAction("Updated support request status.", {
    adminUserId: context.user.id,
    requestId: parsed.data.requestId,
    status: parsed.data.status,
  });

  revalidatePath(SUPPORT_ADMIN_PATH);
  redirectToSupportQueue({
    statusFilter: parsed.data.statusFilter,
    success: "Supportärendet uppdaterades.",
  });
}

export async function assignSupportRequestToMeAction(formData: FormData): Promise<void> {
  const statusFilter = getFormString(formData, "statusFilter");
  rejectInvalidSupportOrigin(statusFilter);

  const parsed = SupportRequestActionSchema.safeParse({
    requestId: getFormString(formData, "requestId"),
    statusFilter,
  });

  if (!parsed.success) {
    redirectToSupportQueue({
      error: "Kunde inte tilldela ärendet.",
      statusFilter,
    });
  }

  const context = await requireSupportAdmin(parsed.data.statusFilter);
  const { error } = await context.adminSupabase
    .from("support_requests")
    .update({
      assigned_to: context.user.id,
      status: "triaged",
    })
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectToSupportQueue({
      error: "Kunde inte tilldela supportärendet just nu.",
      statusFilter: parsed.data.statusFilter,
    });
  }

  logSupportAdminAction("Assigned support request.", {
    adminUserId: context.user.id,
    requestId: parsed.data.requestId,
  });

  revalidatePath(SUPPORT_ADMIN_PATH);
  redirectToSupportQueue({
    statusFilter: parsed.data.statusFilter,
    success: "Supportärendet tilldelades dig.",
  });
}

export async function redactSupportRequestAction(formData: FormData): Promise<void> {
  const statusFilter = getFormString(formData, "statusFilter");
  rejectInvalidSupportOrigin(statusFilter);

  const parsed = SupportRequestActionSchema.safeParse({
    requestId: getFormString(formData, "requestId"),
    statusFilter,
  });
  const confirmed = getFormString(formData, "confirmed") === "yes";

  if (!parsed.success || !confirmed) {
    redirectToSupportQueue({
      error: "Bekräfta redigeringen innan du tar bort innehållet.",
      statusFilter,
    });
  }

  const context = await requireSupportAdmin(parsed.data.statusFilter);
  const now = new Date().toISOString();
  const { error } = await context.adminSupabase
    .from("support_requests")
    .update(buildSupportRequestRedactionUpdate(now))
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectToSupportQueue({
      error: "Kunde inte redigera supportärendet just nu.",
      statusFilter: parsed.data.statusFilter,
    });
  }

  logSupportAdminAction("Redacted support request.", {
    adminUserId: context.user.id,
    requestId: parsed.data.requestId,
  });

  revalidatePath(SUPPORT_ADMIN_PATH);
  redirectToSupportQueue({
    statusFilter: parsed.data.statusFilter,
    success: "Supportärendet redigerades och känsligt innehåll togs bort.",
  });
}

export async function deleteSupportRequestAction(formData: FormData): Promise<void> {
  const statusFilter = getFormString(formData, "statusFilter");
  rejectInvalidSupportOrigin(statusFilter);

  const parsed = SupportRequestActionSchema.safeParse({
    requestId: getFormString(formData, "requestId"),
    statusFilter,
  });
  const confirmed = getFormString(formData, "confirmed") === "yes";

  if (!parsed.success || !confirmed) {
    redirectToSupportQueue({
      error: "Bekräfta radering innan du tar bort supportärendet.",
      statusFilter,
    });
  }

  const context = await requireSupportAdmin(parsed.data.statusFilter);
  const now = new Date().toISOString();
  const { error } = await context.adminSupabase
    .from("support_requests")
    .update(buildSupportRequestSoftDeletionUpdate(now))
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectToSupportQueue({
      error: "Kunde inte radera supportärendet just nu.",
      statusFilter: parsed.data.statusFilter,
    });
  }

  logSupportAdminAction("Soft-deleted support request.", {
    adminUserId: context.user.id,
    requestId: parsed.data.requestId,
  });

  revalidatePath(SUPPORT_ADMIN_PATH);
  redirectToSupportQueue({
    statusFilter: parsed.data.statusFilter,
    success: "Supportärendet raderades och innehållet togs bort.",
  });
}
