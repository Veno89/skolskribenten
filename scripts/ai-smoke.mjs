#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.AI_SMOKE_MODEL ?? "claude-sonnet-4-6";
const timeoutMs = Number.parseInt(process.env.AI_SMOKE_TIMEOUT_MS ?? "60000", 10);

if (!apiKey) {
  console.error("AI smoke failed: ANTHROPIC_API_KEY is not configured.");
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(new Error("AI smoke timed out")), timeoutMs);
const anthropic = new Anthropic({ apiKey });

try {
  const response = await anthropic.messages.create(
    {
      model,
      max_tokens: 160,
      system:
        "Du skriver korta, professionella svenska skoltexter. Du får bara använda avidentifierade placeholders.",
      messages: [
        {
          role: "user",
          content:
            "Skriv en kort lärarlogg utifrån syntetiskt scrubbat underlag: [Elev 1] deltog i grupparbete och behöver nästa steg kring källkritik.",
        },
      ],
    },
    {
      signal: controller.signal,
    },
  );

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  if (!text || !text.includes("[Elev 1]")) {
    console.error("AI smoke failed: response was empty or dropped the required placeholder.");
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      model,
      outputCharacters: text.length,
      placeholderPreserved: true,
    }),
  );
} catch (error) {
  const summary = {
    message: error instanceof Error ? error.message : "Unknown AI smoke error",
    name: error instanceof Error ? error.name : undefined,
  };

  console.error("AI smoke failed:", JSON.stringify(summary));
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
