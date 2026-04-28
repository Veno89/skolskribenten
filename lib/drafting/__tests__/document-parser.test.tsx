import React from "react";
import { describe, expect, it } from "vitest";
import { parseDocument, renderInlineContent } from "../document-parser";

describe("Document Parser", () => {
  describe("parseDocument", () => {
    it("handles empty or whitespace input", () => {
      expect(parseDocument("")).toEqual([]);
      expect(parseDocument("   \n\n  \t")).toEqual([]);
    });

    it("parses dividers", () => {
      const blocks = parseDocument("---");
      expect(blocks).toEqual([{ type: "divider" }]);
    });

    it("parses headings", () => {
      const blocks = parseDocument("## Huvudrubrik\n### Underrubrik");
      expect(blocks).toEqual([
        { type: "heading", level: 2, text: "Huvudrubrik" },
        { type: "heading", level: 3, text: "Underrubrik" },
      ]);
    });

    it("parses sections", () => {
      const blocks = parseDocument("**Viktig sektion**");
      expect(blocks).toEqual([{ type: "section", text: "Viktig sektion" }]);
    });

    it("parses fields with single and multiple lines", () => {
      const blocks = parseDocument("Datum: 2026-04-19\nBeskrivning: Detta är ett test.\nMed en extra rad.");
      expect(blocks).toEqual([
        { type: "field", label: "Datum", text: "2026-04-19" },
        { type: "field", label: "Beskrivning", text: "Detta är ett test. Med en extra rad." },
      ]);
    });

    it("parses unordered lists", () => {
      const blocks = parseDocument("- Första punkten\n* Andra punkten\n- Tredje punkten");
      expect(blocks).toEqual([
        { type: "list", items: ["Första punkten", "Andra punkten", "Tredje punkten"] },
      ]);
    });

    it("parses blockquotes", () => {
      const blocks = parseDocument("> Detta är ett viktigt citat.\n> \n> Som sträcker sig över flera stycken.");
      expect(blocks).toEqual([
        { type: "blockquote", paragraphs: ["Detta är ett viktigt citat.", "Som sträcker sig över flera stycken."] }
      ]);
    });

    it("parses plain paragraphs", () => {
      const blocks = parseDocument("En vanlig textrad.\nSom fortsätter på nästa rad.\n\nEtt nytt stycke.");
      expect(blocks).toEqual([
        { type: "paragraph", text: "En vanlig textrad. Som fortsätter på nästa rad." },
        { type: "paragraph", text: "Ett nytt stycke." },
      ]);
    });

    it("handles incomplete or malformed markdown gracefully", () => {
      const blocks = parseDocument("# \n* \n**\n> \n--- \nField:");
      // Single characters without proper formatting are grouped as a paragraph.
      // Blockquotes without text result in empty paragraphs array.
      // Divider passes cleanly, and Field: without value becomes a paragraph.
      expect(blocks).toEqual([
        { type: "paragraph", text: "# * **" },
        { type: "blockquote", paragraphs: [] },
        { type: "divider" },
        { type: "paragraph", text: "Field:" }
      ]);
    });

    it("parses a mixed document structure", () => {
      const doc = `
## Incidentrapport
**Bakgrund**
Datum: 2026-04-19
- Punkt 1
- Punkt 2
> Observera detta!
---
Slut på rapport.
      `;
      const blocks = parseDocument(doc);
      expect(blocks).toEqual([
        { type: "heading", level: 2, text: "Incidentrapport" },
        { type: "section", text: "Bakgrund" },
        { type: "field", label: "Datum", text: "2026-04-19" },
        { type: "list", items: ["Punkt 1", "Punkt 2"] },
        { type: "blockquote", paragraphs: ["Observera detta!"] },
        { type: "divider" },
        { type: "paragraph", text: "Slut på rapport." }
      ]);
    });
  });

  describe("renderInlineContent", () => {
    it("renders plain text", () => {
      const result = renderInlineContent("Vanlig text");
      const fragment = result[0] as React.ReactElement;

      expect(result).toHaveLength(1);
      expect(fragment.type).toBe(React.Fragment);
      expect(fragment.props.children).toBe("Vanlig text");
    });

    it("renders bold text using **", () => {
      const result = renderInlineContent("Text med **fetstil**");
      const leadingText = result[0] as React.ReactElement;
      const bold = result[1] as React.ReactElement;
      const boldChild = React.Children.toArray(bold.props.children)[0] as React.ReactElement;

      expect(leadingText.props.children).toBe("Text med ");
      expect(bold.type).toBe("strong");
      expect(bold.props.className).toContain("font-semibold");
      expect(boldChild.props.children).toBe("fetstil");
    });

    it("renders GDPR entities like [Elev 1] distinctively", () => {
      const result = renderInlineContent("Det var [Elev 1] som kastade.");
      const leadingText = result[0] as React.ReactElement;
      const placeholder = result[1] as React.ReactElement;
      const trailingText = result[2] as React.ReactElement;

      expect(leadingText.props.children).toBe("Det var ");
      expect(placeholder.type).toBe("span");
      expect(placeholder.props.className).toContain("rounded-full");
      expect(placeholder.props.children).toBe("[Elev 1]");
      expect(trailingText.props.children).toBe(" som kastade.");
    });

    it("combines multiple formatting types", () => {
      const result = renderInlineContent("**[Elev 1]** gjorde nåt **bra**");
      const firstBold = result[0] as React.ReactElement;
      const middleText = result[1] as React.ReactElement;
      const secondBold = result[2] as React.ReactElement;
      const placeholder = React.Children.toArray(firstBold.props.children)[0] as React.ReactElement;
      const secondBoldText = React.Children.toArray(secondBold.props.children)[0] as React.ReactElement;

      expect(firstBold.type).toBe("strong");
      expect(placeholder.type).toBe("span");
      expect(placeholder.props.children).toBe("[Elev 1]");
      expect(middleText.props.children).toBe(" gjorde nåt ");
      expect(secondBoldText.props.children).toBe("bra");
    });
  });
});
