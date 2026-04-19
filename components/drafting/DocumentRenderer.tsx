"use client";

import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { TemplateType } from "@/types";

type DocumentBlock =
  | { type: "divider" }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "section"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "blockquote"; paragraphs: string[] };

const TEMPLATE_META: Record<
  TemplateType,
  { label: string; eyebrow: string; summary: string }
> = {
  incidentrapport: {
    label: "Incidentrapport",
    eyebrow: "AI-utkast",
    summary: "Saklig struktur för dokumentation, åtgärder och uppföljning.",
  },
  larlogg: {
    label: "Lärlogg",
    eyebrow: "AI-utkast",
    summary: "Pedagogisk dokumentation med lärandefokus och nästa steg.",
  },
  veckobrev: {
    label: "Veckobrev",
    eyebrow: "AI-utkast",
    summary: "Tydlig kommunikation till vårdnadshavare i ett varmtonat format.",
  },
  custom: {
    label: "Eget dokument",
    eyebrow: "AI-utkast",
    summary: "Ett bearbetat utkast som går att justera vidare innan du använder det.",
  },
};

function isDividerLine(line: string): boolean {
  return /^---+$/.test(line.trim());
}

function getHeadingMatch(line: string): RegExpMatchArray | null {
  return line.trim().match(/^(#{2,3})\s+(.+)$/);
}

function isSectionLine(line: string): boolean {
  return /^\*\*.+\*\*$/.test(line.trim());
}

function isBulletLine(line: string): boolean {
  return /^[-*]\s+/.test(line.trim());
}

function isBlockquoteLine(line: string): boolean {
  return /^>\s?/.test(line.trim());
}

function isStructuralLine(line: string): boolean {
  return (
    isDividerLine(line) ||
    Boolean(getHeadingMatch(line)) ||
    isSectionLine(line) ||
    isBulletLine(line) ||
    isBlockquoteLine(line)
  );
}

function parseDocument(content: string): DocumentBlock[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: DocumentBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (isDividerLine(trimmed)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    const headingMatch = getHeadingMatch(trimmed);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length === 2 ? 2 : 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (isSectionLine(trimmed)) {
      blocks.push({
        type: "section",
        text: trimmed.replace(/^\*\*|\*\*$/g, "").trim(),
      });
      index += 1;
      continue;
    }

    if (isBulletLine(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && isBulletLine(lines[index])) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "list", items });
      continue;
    }

    if (isBlockquoteLine(trimmed)) {
      const quoteLines: string[] = [];

      while (index < lines.length && (isBlockquoteLine(lines[index]) || !lines[index].trim())) {
        quoteLines.push(lines[index].replace(/^>\s?/, "").trim());
        index += 1;
      }

      const paragraphs = quoteLines
        .join("\n")
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
        .filter(Boolean);

      blocks.push({ type: "blockquote", paragraphs });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length && lines[index].trim() && !isStructuralLine(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function renderInlineContent(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g)
    .filter(Boolean)
    .map((segment, index) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <strong key={`${segment}-${index}`} className="font-semibold text-[var(--ss-neutral-900)]">
            {renderInlineContent(segment.slice(2, -2))}
          </strong>
        );
      }

      if (/^\[[^\]]+\]$/.test(segment)) {
        return (
          <span
            key={`${segment}-${index}`}
            className="mx-0.5 inline-flex rounded-full border border-[var(--ss-primary)]/20 bg-[var(--ss-primary-light)] px-2.5 py-0.5 text-[0.82rem] font-semibold text-[var(--ss-primary-dark)]"
          >
            {segment}
          </span>
        );
      }

      return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
    });
}

interface Props {
  content: string;
  templateType: TemplateType;
}

export function DocumentRenderer({ content, templateType }: Props): JSX.Element {
  const blocks = parseDocument(content);
  const meta = TEMPLATE_META[templateType];

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
                <div key={`heading-${index}`} className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--ss-primary)]">
                    Dokumentrubrik
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--ss-neutral-900)]">
                    {block.text}
                  </h2>
                </div>
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
                <div key={`section-${index}`} className="rounded-[1.4rem] bg-white/80 px-4 py-3 shadow-sm ring-1 ring-[var(--ss-neutral-100)]">
                  <h4 className="text-base font-semibold text-[var(--ss-neutral-900)]">
                    {renderInlineContent(block.text)}
                  </h4>
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
