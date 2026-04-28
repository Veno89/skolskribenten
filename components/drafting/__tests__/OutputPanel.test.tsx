// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/drafting/OutputPanel";

let writeText: ReturnType<typeof vi.fn>;

describe("OutputPanel", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("ClipboardItem", undefined);
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });
  });

  it("renders the empty state until a completion exists", () => {
    render(
      <OutputPanel
        completion=""
        isLoading={false}
        templateType="larlogg"
      />,
    );

    expect(screen.getByText(/Din färdiga text visas här/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kopiera" })).toBeDisabled();
  });

  it("copies generated content as plain text when rich clipboard is unavailable", async () => {
    render(
      <OutputPanel
        completion="Observation: Eleven arbetade fokuserat."
        isLoading={false}
        templateType="larlogg"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kopiera" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Observation: Eleven arbetade fokuserat."),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Kopierat" })).toBeEnabled());
  });

  it("shows guard warnings and route errors", () => {
    render(
      <OutputPanel
        completion=""
        error="AI-svaret stoppades."
        isLoading={false}
        templateType="incidentrapport"
        warnings={["Granska elevmarkörer extra noggrant."]}
      />,
    );

    expect(screen.getByText(/Något gick fel: AI-svaret stoppades/i)).toBeInTheDocument();
    expect(screen.queryByText(/Granska AI-svaret extra noggrant/i)).not.toBeInTheDocument();
  });
});
