import { describe, expect, it } from "vitest";
import {
  SUPPORT_DELETED_PLACEHOLDER,
  SUPPORT_REDACTED_PLACEHOLDER,
  buildSupportRequestRedactionUpdate,
  buildSupportRequestSoftDeletionUpdate,
  buildSupportRequestStatusUpdate,
  getSupportStatusFilterStatuses,
  parseSupportStatusFilter,
} from "@/lib/support/admin";

describe("support admin helpers", () => {
  it("parses support queue filters safely", () => {
    expect(parseSupportStatusFilter("resolved")).toBe("resolved");
    expect(parseSupportStatusFilter("open")).toBe("open");
    expect(parseSupportStatusFilter("unexpected")).toBe("open");
    expect(parseSupportStatusFilter(undefined)).toBe("open");

    expect(getSupportStatusFilterStatuses("open")).toEqual(["new", "triaged", "in_progress"]);
    expect(getSupportStatusFilterStatuses("all")).toBeNull();
    expect(getSupportStatusFilterStatuses("spam")).toEqual(["spam"]);
  });

  it("stamps handled_at only for terminal support statuses", () => {
    const now = "2026-04-26T12:00:00.000Z";

    expect(buildSupportRequestStatusUpdate("in_progress", now)).toEqual({
      status: "in_progress",
    });
    expect(buildSupportRequestStatusUpdate("resolved", now)).toEqual({
      handled_at: now,
      status: "resolved",
    });
  });

  it("redacts support request content while preserving lifecycle metadata", () => {
    const now = "2026-04-26T12:00:00.000Z";

    expect(buildSupportRequestRedactionUpdate(now)).toEqual({
      email: "redacted@support.skolskribenten.local",
      handled_at: now,
      message: SUPPORT_REDACTED_PLACEHOLDER,
      name: SUPPORT_REDACTED_PLACEHOLDER,
      redacted_at: now,
      role: null,
      status: "redacted",
    });
  });

  it("soft-deletes support request content without hard-deleting the audit row", () => {
    const now = "2026-04-26T12:00:00.000Z";

    expect(buildSupportRequestSoftDeletionUpdate(now)).toEqual({
      deleted_at: now,
      email: "deleted@support.skolskribenten.local",
      handled_at: now,
      message: SUPPORT_DELETED_PLACEHOLDER,
      name: SUPPORT_DELETED_PLACEHOLDER,
      redacted_at: now,
      role: null,
      status: "deleted",
    });
  });
});
