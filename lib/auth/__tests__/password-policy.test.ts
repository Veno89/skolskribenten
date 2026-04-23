import { describe, expect, it } from "vitest";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  PasswordSchema,
} from "@/lib/auth/password-policy";

describe("PasswordSchema", () => {
  it("accepts passwords that meet the strengthened baseline", () => {
    const parsed = PasswordSchema.parse("StarkarePass123");

    expect(parsed).toBe("StarkarePass123");
  });

  it("rejects passwords that are too short", () => {
    const parsed = PasswordSchema.safeParse("KortA1");

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected password validation to fail for short passwords.");
    }
    expect(parsed.error.issues[0]?.message).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it("rejects passwords that do not include lowercase, uppercase, and digits", () => {
    const parsed = PasswordSchema.safeParse("baraenlangfrasutan123");

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected password validation to fail for missing character classes.");
    }
    expect(parsed.error.issues[0]?.message).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });
});
