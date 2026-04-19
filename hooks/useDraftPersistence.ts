"use client";

import { useEffect, useState } from "react";
import {
  LEGACY_DRAFT_STORAGE_KEY,
  getDraftStorageKey,
  isDraftTimestampExpired,
} from "@/lib/drafting/draft-storage";
import { isTemplateType } from "@/lib/drafting/template-content";
import { TEMPLATE_TYPES } from "@/lib/ai/provider";
import type { TemplateType } from "@/types";

const DEFAULT_TEMPLATE: TemplateType = "larlogg";

interface TemplateDraft {
  rawInput: string;
  customNames: string[];
  savedAt: string | null;
}

type DraftRecord = Record<TemplateType, TemplateDraft>;

function createEmptyDraft(): TemplateDraft {
  return {
    rawInput: "",
    customNames: [],
    savedAt: null,
  };
}

function createDraftRecord(): DraftRecord {
  return Object.fromEntries(TEMPLATE_TYPES.map((template) => [template, createEmptyDraft()])) as DraftRecord;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeDraft(value: unknown): TemplateDraft {
  if (!value || typeof value !== "object") {
    return createEmptyDraft();
  }

  const candidate = value as Partial<TemplateDraft>;

  return {
    rawInput: typeof candidate.rawInput === "string" ? candidate.rawInput : "",
    customNames: isStringArray(candidate.customNames) ? candidate.customNames : [],
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : null,
  };
}

function sanitizeDraft(value: unknown): TemplateDraft {
  const draft = normalizeDraft(value);
  return isDraftTimestampExpired(draft.savedAt) ? createEmptyDraft() : draft;
}

function parseStoredDrafts(rawValue: string | null): {
  activeTemplate: TemplateType;
  drafts: DraftRecord;
} | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as {
      activeTemplate?: string;
      drafts?: Record<string, unknown>;
    };
    const candidateActiveTemplate = parsed.activeTemplate ?? "";
    const activeTemplate = isTemplateType(candidateActiveTemplate)
      ? candidateActiveTemplate
      : DEFAULT_TEMPLATE;
    const drafts = createDraftRecord();

    for (const template of TEMPLATE_TYPES) {
      drafts[template] = sanitizeDraft(parsed.drafts?.[template]);
    }

    return { activeTemplate, drafts };
  } catch {
    return null;
  }
}

function getSavedAtLabel(savedAt: string | null): string | null {
  if (!savedAt) {
    return null;
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useDraftPersistence(userId: string) {
  const [rawInput, setRawInput] = useState("");
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(DEFAULT_TEMPLATE);
  const [draftsByTemplate, setDraftsByTemplate] = useState<DraftRecord>(createDraftRecord);
  const [hasHydratedDrafts, setHasHydratedDrafts] = useState(false);
  const storageKey = getDraftStorageKey(userId);
  const activeDraft = draftsByTemplate[selectedTemplate];
  const savedAtLabel = getSavedAtLabel(activeDraft?.savedAt ?? null);
  const hasSavedDraft = Boolean(rawInput.trim() || customNames.length > 0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
      const stored = parseStoredDrafts(window.localStorage.getItem(storageKey));

      if (stored) {
        setDraftsByTemplate(stored.drafts);
        setSelectedTemplate(stored.activeTemplate);
        setRawInput(stored.drafts[stored.activeTemplate].rawInput);
        setCustomNames(stored.drafts[stored.activeTemplate].customNames);
      }
    } catch {
      // Ignore browsers where local persistence is unavailable.
    }

    setHasHydratedDrafts(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydratedDrafts || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          activeTemplate: selectedTemplate,
          drafts: draftsByTemplate,
        }),
      );
    } catch {
      // Ignore browsers where local persistence is unavailable.
    }
  }, [draftsByTemplate, hasHydratedDrafts, selectedTemplate, storageKey]);

  const updateActiveDraft = (nextInput: string, nextCustomNames: string[]) => {
    setDraftsByTemplate((currentDrafts) => ({
      ...currentDrafts,
      [selectedTemplate]: {
        rawInput: nextInput,
        customNames: nextCustomNames,
        savedAt: nextInput.trim() || nextCustomNames.length > 0 ? new Date().toISOString() : null,
      },
    }));
  };

  const updateRawInput = (value: string) => {
    setRawInput(value);
    updateActiveDraft(value, customNames);
  };

  const updateCustomNames = (nextNames: string[]) => {
    setCustomNames(nextNames);
    updateActiveDraft(rawInput, nextNames);
  };

  const switchTemplate = (nextTemplate: TemplateType): boolean => {
    if (nextTemplate === selectedTemplate) {
      return false;
    }

    const nextDraft = draftsByTemplate[nextTemplate] ?? createEmptyDraft();
    setSelectedTemplate(nextTemplate);
    setRawInput(nextDraft.rawInput);
    setCustomNames(nextDraft.customNames);

    return true;
  };

  const clearActiveDraft = () => {
    setRawInput("");
    setCustomNames([]);
    setDraftsByTemplate((currentDrafts) => ({
      ...currentDrafts,
      [selectedTemplate]: createEmptyDraft(),
    }));
  };

  return {
    clearActiveDraft,
    customNames,
    hasSavedDraft,
    rawInput,
    savedAtLabel,
    selectedTemplate,
    switchTemplate,
    updateCustomNames,
    updateRawInput,
  };
}
