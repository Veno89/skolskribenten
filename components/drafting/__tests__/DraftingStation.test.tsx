// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftingStation } from "@/components/drafting/DraftingStation";
import type { Profile } from "@/types";

const mocks = vi.hoisted(() => ({
  clearActiveDraft: vi.fn(),
  generateDocument: vi.fn(),
  replaceDraft: vi.fn(),
  resetGenerationState: vi.fn(),
  switchTemplate: vi.fn(),
  updateCustomNames: vi.fn(),
  updateRawInput: vi.fn(),
  useDocumentGeneration: vi.fn(),
  useDraftPersistence: vi.fn(),
}));

vi.mock("@/hooks/useDraftPersistence", () => ({
  useDraftPersistence: mocks.useDraftPersistence,
}));

vi.mock("@/hooks/useDocumentGeneration", () => ({
  useDocumentGeneration: mocks.useDocumentGeneration,
}));

vi.mock("@/components/drafting/DraftingOnboardingPanel", () => ({
  DraftingOnboardingPanel: ({
    onUseSample,
  }: {
    onUseSample: (sample: { input: string; template: "larlogg" }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onUseSample({
          input: "Eleven visade uthållighet i problemlösningen.",
          template: "larlogg",
        })
      }
    >
      Använd exempel
    </button>
  ),
}));

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    api_call_count: 0,
    api_call_window_start: "2026-04-28T00:00:00.000Z",
    created_at: "2026-04-28T00:00:00.000Z",
    email: "larare@example.se",
    full_name: "Lärare Test",
    id: "profile-123",
    school_name: "TestskoLan",
    stripe_customer_id: null,
    subscription_end_date: null,
    subscription_status: "free",
    transforms_reset_at: "2026-05-01T00:00:00.000Z",
    transforms_used_this_month: 1,
    updated_at: "2026-04-28T00:00:00.000Z",
    user_settings: {},
    ...overrides,
  };
}

describe("DraftingStation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateDocument.mockResolvedValue(undefined);
    mocks.switchTemplate.mockReturnValue(true);
    mocks.useDraftPersistence.mockReturnValue({
      clearActiveDraft: mocks.clearActiveDraft,
      customNames: ["Amir"],
      hasSavedDraft: true,
      rawInput: "Eleven tog hjälp av konkret material.",
      replaceDraft: mocks.replaceDraft,
      savedAtLabel: "14:05",
      selectedTemplate: "larlogg",
      switchTemplate: mocks.switchTemplate,
      updateCustomNames: mocks.updateCustomNames,
      updateRawInput: mocks.updateRawInput,
    });
    mocks.useDocumentGeneration.mockReturnValue({
      completion: "",
      error: undefined,
      generateDocument: mocks.generateDocument,
      isLoading: false,
      outputWarnings: [],
      resetGenerationState: mocks.resetGenerationState,
      scrubberStats: null,
      unmatchedWarnings: [],
    });
  });

  it("submits the selected template, raw input, and custom names to generation", async () => {
    const user = userEvent.setup();

    render(<DraftingStation userProfile={buildProfile()} />);

    expect(
      screen.getByLabelText("Anteckningar som ska omvandlas till pedagogisk dokumentation"),
    ).toHaveValue("Eleven tog hjälp av konkret material.");

    await user.click(screen.getByRole("button", { name: /Generera dokument/i }));

    expect(mocks.generateDocument).toHaveBeenCalledWith({
      customNames: ["Amir"],
      rawInput: "Eleven tog hjälp av konkret material.",
      safeCapitalizedWords: undefined,
      templateType: "larlogg",
    });
  });

  it("resets output state when a teacher switches template or uses the sample", async () => {
    const user = userEvent.setup();

    render(<DraftingStation userProfile={buildProfile()} />);

    await user.click(screen.getByRole("button", { name: "Incidentrapport" }));
    expect(mocks.switchTemplate).toHaveBeenCalledWith("incidentrapport");
    expect(mocks.resetGenerationState).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Använd exempel" }));
    expect(mocks.replaceDraft).toHaveBeenCalledWith(
      "larlogg",
      "Eleven visade uthållighet i problemlösningen.",
    );
    expect(mocks.resetGenerationState).toHaveBeenCalledTimes(2);
  });

  it("disables generation and links to account when the quota is exceeded", () => {
    render(
      <DraftingStation
        userProfile={buildProfile({
          transforms_used_this_month: 10,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /Månadsgräns nådd/i })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Gå till konto/i })).toHaveAttribute("href", "/konto");
  });
});
