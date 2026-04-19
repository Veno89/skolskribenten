import { describe, expect, it } from "vitest";
import {
  UpdateProfileSettingsSchema,
  buildUserSettings,
  parseUserSettings,
} from "../user-settings";

describe("UpdateProfileSettingsSchema", () => {
  it("trims text inputs and converts blank option values into undefined", () => {
    const result = UpdateProfileSettingsSchema.parse({
      fullName: "  Ada Larsson  ",
      schoolName: "  ",
      schoolLevel: "",
      preferredTone: "warm",
    });

    expect(result).toEqual({
      fullName: "Ada Larsson",
      schoolName: undefined,
      schoolLevel: undefined,
      preferredTone: "warm",
    });
  });

  it("rejects too-short names", () => {
    const result = UpdateProfileSettingsSchema.safeParse({
      fullName: "A",
      schoolName: "",
      schoolLevel: "",
      preferredTone: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("parseUserSettings", () => {
  it("returns empty settings for invalid json payloads", () => {
    expect(parseUserSettings("invalid")).toEqual({});
  });

  it("keeps supported values and strips unknown keys", () => {
    expect(
      parseUserSettings({
        schoolLevel: "7-9",
        preferredTone: "formal",
        extra: "ignored",
      }),
    ).toEqual({
      schoolLevel: "7-9",
      preferredTone: "formal",
    });
  });
});

describe("buildUserSettings", () => {
  it("creates a compact settings object for storage", () => {
    expect(
      buildUserSettings({
        schoolLevel: "4-6",
        preferredTone: undefined,
      }),
    ).toEqual({
      schoolLevel: "4-6",
    });
  });
});
