import { describe, expect, it } from "vitest";
import { SupportRequestSchema } from "@/lib/support/schema";

describe("SupportRequestSchema", () => {
  it("accepts a valid support request and trims values", () => {
    const parsed = SupportRequestSchema.parse({
      email: "  larare@skola.se ",
      message: "  Jag får ett fel när jag försöker generera ett dokument.  ",
      name: "  Anna Andersson ",
      role: "  Klasslärare åk 5 ",
      topic: "Tekniskt problem",
    });

    expect(parsed).toEqual({
      email: "larare@skola.se",
      message: "Jag får ett fel när jag försöker generera ett dokument.",
      name: "Anna Andersson",
      role: "Klasslärare åk 5",
      topic: "Tekniskt problem",
    });
  });

  it("allows role to be omitted", () => {
    const parsed = SupportRequestSchema.parse({
      email: "larare@skola.se",
      message: "Jag vill gärna dela feedback från pilotanvändning.",
      name: "Sara",
      role: "",
      topic: "Feedback från testning",
    });

    expect(parsed.role).toBeUndefined();
  });

  it("rejects too-short messages", () => {
    const parsed = SupportRequestSchema.safeParse({
      email: "larare@skola.se",
      message: "För kort",
      name: "Sara",
      topic: "Allmän fråga",
    });

    expect(parsed.success).toBe(false);
  });
});
