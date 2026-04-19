import React, { Fragment, type ReactNode } from "react";

export type DocumentBlock =
  | { type: "divider" }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "section"; text: string }
  | { type: "field"; label: string; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "blockquote"; paragraphs: string[] };

function isDividerLine(line: string): boolean {
  return /^---+$/.test(line.trim());
}

function getHeadingMatch(line: string): RegExpMatchArray | null {
  return line.trim().match(/^(#{2,3})\s+(.+)$/);
}

function isSectionLine(line: string): boolean {
  return /^\*\*.+\*\*$/.test(line.trim());
}

function getFieldMatch(line: string): RegExpMatchArray | null {
  return line
    .trim()
    .match(/^([A-ZÅÄÖa-zåäö0-9][A-ZÅÄÖa-zåäö0-9 /()&-]{1,40}):\s*(.+)$/);
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
    Boolean(getFieldMatch(line)) ||
    isBulletLine(line) ||
    isBlockquoteLine(line)
  );
}

export function parseDocument(content: string): DocumentBlock[] {
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

    const fieldMatch = getFieldMatch(trimmed);

    if (fieldMatch) {
      const extraLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() && !isStructuralLine(lines[index])) {
        extraLines.push(lines[index].trim());
        index += 1;
      }

      blocks.push({
        type: "field",
        label: fieldMatch[1].trim(),
        text: [fieldMatch[2].trim(), ...extraLines].join(" ").trim(),
      });
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

export function renderInlineContent(text: string): ReactNode[] {
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
