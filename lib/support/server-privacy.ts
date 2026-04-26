import { createHash } from "crypto";
import {
  detectPotentialSensitiveContent,
  type PotentialSensitiveContentFinding,
} from "@/lib/gdpr/server-guard";

export function hashSupportEmail(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

function getSupportSensitiveContentLabel(finding: PotentialSensitiveContentFinding): string {
  switch (finding.type) {
    case "email":
      return "e-postadress";
    case "known_name":
      return "namn";
    case "personnummer":
      return "personnummer";
    case "phone":
      return "telefonnummer";
    case "samordningsnummer":
      return "samordningsnummer";
    case "capitalized_word":
      return "ord som ser ut som namn";
  }
}

export function detectSupportSensitiveContent(message: string): PotentialSensitiveContentFinding[] {
  return detectPotentialSensitiveContent(message);
}

export function formatSupportSensitiveContentMessage(
  findings: PotentialSensitiveContentFinding[],
): string {
  const labels = Array.from(new Set(findings.map(getSupportSensitiveContentLabel)));
  const suffix = labels.length > 0 ? ` (${labels.join(", ")})` : "";

  return `Meddelandet verkar innehålla personuppgifter${suffix}. Beskriv ärendet utan elevnamn, personnummer, telefonnummer, e-postadresser eller fulla råanteckningar.`;
}

export function summarizeSupportSensitiveContentTypes(
  findings: PotentialSensitiveContentFinding[],
): string {
  return Array.from(new Set(findings.map((finding) => finding.type))).join(",");
}
