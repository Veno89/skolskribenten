"use client";

import { TEMPLATE_OPTIONS } from "@/lib/drafting/template-content";
import { cn } from "@/lib/utils";
import type { TemplateType } from "@/types";

interface Props {
  value: TemplateType;
  onChange: (templateType: TemplateType) => void;
}

export function TemplatePicker({ value, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Välj dokumentmall">
      {TEMPLATE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            value === option.value
              ? "bg-[var(--ss-primary)] text-white shadow-md"
              : "bg-[var(--ss-neutral-100)] text-[var(--ss-neutral-800)] hover:bg-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
