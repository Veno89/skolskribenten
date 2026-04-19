"use client";

import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { TEMPLATE_DETAILS } from "@/lib/drafting/template-content";
import type { TemplateType } from "@/types";

import { parseDocument, renderInlineContent } from "@/lib/drafting/document-parser";

interface Props {
  content: string;
  templateType: TemplateType;
}

export function DocumentRenderer({ content, templateType }: Props): JSX.Element {
  const blocks = parseDocument(content);
  const meta = TEMPLATE_DETAILS[templateType];

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-[var(--ss-neutral-100)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,247,245,0.98))] shadow-[0_28px_90px_-38px_rgba(26,25,23,0.35)]">
      <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(74,127,165,0.14),transparent_68%)]" />

      <header className="relative border-b border-[var(--ss-neutral-100)] px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-full bg-[var(--ss-secondary-light)] px-3 py-1 text-[var(--ss-neutral-900)] hover:bg-[var(--ss-secondary-light)]">
            {meta.eyebrow}
          </Badge>
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Redo att granska och kopiera
          </span>
        </div>
        <h3
          className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ss-neutral-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {meta.label}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{meta.summary}</p>
      </header>

      <div className="relative space-y-6 px-6 py-6 md:px-8 md:py-8">
        {blocks.map((block, index) => {
          switch (block.type) {
            case "divider":
              return (
                <div
                  key={`divider-${index}`}
                  className="h-px bg-[linear-gradient(90deg,transparent,rgba(74,127,165,0.22),transparent)]"
                />
              );

            case "heading":
              return block.level === 2 ? (
                <h2
                  key={`heading-${index}`}
                  className="text-2xl font-semibold tracking-tight text-[var(--ss-neutral-900)]"
                >
                  {block.text}
                </h2>
              ) : (
                <h3
                  key={`heading-${index}`}
                  className="text-xl font-semibold tracking-tight text-[var(--ss-neutral-900)]"
                >
                  {block.text}
                </h3>
              );

            case "section":
              return (
                <div
                  key={`section-${index}`}
                  className="rounded-[1.4rem] bg-white/80 px-4 py-3 shadow-sm ring-1 ring-[var(--ss-neutral-100)]"
                >
                  <h4 className="text-base font-semibold text-[var(--ss-neutral-900)]">
                    {renderInlineContent(block.text)}
                  </h4>
                </div>
              );

            case "field":
              return (
                <div
                  key={`field-${index}`}
                  className="rounded-[1.5rem] border border-[var(--ss-neutral-100)] bg-white/90 px-4 py-4 shadow-sm"
                >
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--ss-primary)]">
                    {block.label}
                  </p>
                  <p className="mt-2 text-[0.97rem] leading-8 text-[var(--ss-neutral-800)]">
                    {renderInlineContent(block.text)}
                  </p>
                </div>
              );

            case "paragraph":
              return (
                <p
                  key={`paragraph-${index}`}
                  className="text-[0.97rem] leading-8 text-[var(--ss-neutral-800)]"
                >
                  {renderInlineContent(block.text)}
                </p>
              );

            case "list":
              return (
                <ul key={`list-${index}`} className="space-y-3">
                  {block.items.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`} className="grid grid-cols-[0.55rem,1fr] gap-3">
                      <span className="mt-3 h-2.5 w-2.5 rounded-full bg-[var(--ss-primary)]/70" />
                      <span className="text-[0.97rem] leading-8 text-[var(--ss-neutral-800)]">
                        {renderInlineContent(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              );

            case "blockquote":
              return (
                <aside
                  key={`blockquote-${index}`}
                  className="rounded-[1.7rem] border border-amber-200/80 bg-[linear-gradient(180deg,#fff9ef,#fff4df)] px-5 py-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900">
                      !
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-amber-900/70">
                        Viktig notering
                      </p>
                      <p className="text-sm font-medium text-amber-950">
                        Läs igenom innan du använder texten
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 text-[0.95rem] leading-8 text-amber-950">
                    {block.paragraphs.map((paragraph, paragraphIndex) => (
                      <p key={`${paragraph}-${paragraphIndex}`}>{renderInlineContent(paragraph)}</p>
                    ))}
                  </div>
                </aside>
              );
          }
        })}
      </div>
    </article>
  );
}
