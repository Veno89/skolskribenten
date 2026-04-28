import { describe, expect, it, vi } from "vitest";
import {
  checkBreachedPassword,
  findPwnedPasswordCount,
  getPasswordSha1Range,
} from "../breached-password";

describe("breached password checking", () => {
  it("builds the HIBP k-anonymity range from the SHA-1 hash", () => {
    expect(getPasswordSha1Range("password")).toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });

  it("finds matching suffix counts and ignores padded zero-count entries", () => {
    expect(
      findPwnedPasswordCount(
        [
          "00000000000000000000000000000000000:0",
          "1E4C9B93F3F0682250B6CF8331B7EE68FD8:3303003",
        ].join("\r\n"),
        "1e4c9b93f3f0682250b6cf8331b7ee68fd8",
      ),
    ).toBe(3303003);
  });

  it("reports compromised passwords without sending the full hash", async () => {
    const fetcher = vi.fn(async () =>
      new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3303003", {
        status: 200,
      }),
    );

    await expect(
      checkBreachedPassword("password", {
        fetcher,
      }),
    ).resolves.toEqual({
      checked: true,
      compromised: true,
      count: 3303003,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.pwnedpasswords.com/range/5BAA6",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Add-Padding": "true",
        }),
      }),
    );
  });

  it("can be disabled for isolated environments", async () => {
    const fetcher = vi.fn();

    await expect(
      checkBreachedPassword("StarkarePass123!", {
        env: { HIBP_PASSWORD_CHECK_DISABLED: "true" } as unknown as NodeJS.ProcessEnv,
        fetcher,
      }),
    ).resolves.toEqual({
      checked: false,
      compromised: false,
      count: 0,
      reason: "disabled",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
