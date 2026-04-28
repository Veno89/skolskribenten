// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import type { Profile } from "@/types";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => <button type="button">Logga ut</button>,
}));

vi.mock("@/components/drafting/UsageCounter", () => ({
  UsageCounter: () => <span>1 av 10 gratis omvandlingar använda</span>,
}));

function buildProfile(): Profile {
  return {
    api_call_count: 0,
    api_call_window_start: "2026-04-28T00:00:00.000Z",
    created_at: "2026-04-28T00:00:00.000Z",
    email: "larare@example.se",
    full_name: "Lärare Test",
    id: "profile-123",
    school_name: null,
    stripe_customer_id: null,
    subscription_end_date: null,
    subscription_status: "free",
    transforms_reset_at: "2026-05-01T00:00:00.000Z",
    transforms_used_this_month: 1,
    updated_at: "2026-04-28T00:00:00.000Z",
    user_settings: {},
  };
}

describe("DashboardNav", () => {
  beforeEach(() => {
    mocks.usePathname.mockReturnValue("/skrivstation");
  });

  it("renders the primary dashboard links", () => {
    render(<DashboardNav profile={buildProfile()} />);

    expect(screen.getAllByRole("link", { name: "Skrivstation" })[0]).toHaveAttribute(
      "href",
      "/skrivstation",
    );
    expect(screen.getByRole("link", { name: "Lektioner" })).toHaveAttribute(
      "href",
      "/lektionsplanering",
    );
    expect(screen.getByRole("link", { name: "Konto" })).toHaveAttribute("href", "/konto");
  });

  it("reveals admin links in the mobile menu", async () => {
    const user = userEvent.setup();

    render(<DashboardNav isAppAdmin profile={buildProfile()} />);

    await user.click(screen.getByRole("button", { name: /meny/i }));

    expect(screen.getAllByRole("link", { name: "Support" })[0]).toHaveAttribute(
      "href",
      "/admin/support",
    );
    expect(screen.getAllByRole("link", { name: "AI" })[0]).toHaveAttribute(
      "href",
      "/admin/ai-governance",
    );
    expect(screen.getAllByText(/gratis omvandlingar/i).length).toBeGreaterThan(0);
  });
});
