"use client";

import { useState } from "react";
import { useCompletion } from "@/hooks/useCompletion";
import { GdprScrubber } from "@/lib/gdpr/scrubber";
import type { ScrubberStats, TemplateType } from "@/types";

const scrubber = new GdprScrubber();

export function useDocumentGeneration() {
  const [scrubberStats, setScrubberStats] = useState<ScrubberStats | null>(null);
  const [unmatchedWarnings, setUnmatchedWarnings] = useState<string[]>([]);
  const { complete, completion, error, isLoading, reset } = useCompletion({
    api: "/api/ai",
  });

  const resetGenerationState = () => {
    setScrubberStats(null);
    setUnmatchedWarnings([]);
    reset();
  };

  const generateDocument = async (params: {
    customNames: string[];
    rawInput: string;
    templateType: TemplateType;
  }) => {
    if (!params.rawInput.trim()) {
      return;
    }

    const result = scrubber.scrub(params.rawInput, { customNames: params.customNames });

    setScrubberStats(result.stats);
    setUnmatchedWarnings(result.unmatchedCapitalized);

    try {
      await complete("", {
        body: {
          templateType: params.templateType,
          scrubbedInput: result.scrubbedText,
          scrubberStats: result.stats,
        },
      });
    } catch {
      // Hook state already exposes the error in the output panel.
    }
  };

  return {
    completion,
    error,
    generateDocument,
    isLoading,
    resetGenerationState,
    scrubberStats,
    unmatchedWarnings,
  };
}
