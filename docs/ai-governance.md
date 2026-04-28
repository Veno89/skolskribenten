# AI Governance Operations

Last updated: April 28, 2026.

This document describes the current AI generation control plane. It is an operational contract, not a guarantee that the model can never produce bad text.

## Request State Model

1. Browser scrubber removes known names and structural identifiers before `/api/ai`.
2. Server scrubber runs again on the submitted text, using the user's safe capitalized words.
3. Server sensitive-content guard rejects obvious remaining personal data before generation.
4. Quota/rate-limit reservation is created through the generation-attempt RPC.
5. Anthropic generation runs with the server-owned prompt/model configuration and a server timeout.
6. The server waits for the first generated text chunk, validates it with the output guard, then starts streaming text to the browser.
7. Each later chunk is appended to the accumulated generated text and checked by the output guard before it is sent.
8. If the output guard blocks before streaming starts, the reserved transform is released, a non-content usage event is recorded, and no generated text is returned.
9. If the output guard blocks mid-stream, the stream errors, the reserved transform is released when needed, and a non-content usage event is recorded.
10. If the output guard passes through the full stream, a non-content usage event is recorded, non-blocking warnings are stored as metadata, and the text is returned.

## Usage Metadata

`usage_events` stores operational metadata only:
- `ai_provider`
- `ai_model`
- `prompt_version`
- `output_guard_version`
- `output_guard_passed`
- `output_guard_warnings`

Do not store raw prompts, scrubbed input, generated output, pupil names, support messages, or payment details in this table.

## Output Guard Policy

Blocking conditions:
- generated text introduces a new person placeholder such as `[Elev 2]` that was not present in the scrubbed input
- generated text appears to contain obvious personal data detected as email, known name, personnummer, phone, or samordningsnummer

Warning conditions:
- generated text drops a placeholder that appeared in the scrubbed input
- generated text includes capitalized words that may deserve teacher review

Warnings are shown in the drafting output panel and recorded as labels/messages in `usage_events.output_guard_warnings`. The warning text must not include raw generated content.

## Eval Baseline

The offline baseline lives in:
- `lib/ai/eval-fixtures.ts`
- `lib/ai/__tests__/output-guard.test.ts`
- `app/api/ai/route.test.ts`

Run:

```bash
pnpm test -- app/api/ai/route.test.ts lib/ai/__tests__/output-guard.test.ts
```

Current coverage proves:
- prompt/model/output-guard metadata is emitted
- fixture prompts keep critical clauses
- required placeholders are tracked
- obvious personal data in generated output blocks response delivery
- non-blocking warnings reach usage metadata
- blocked output releases the reserved transform
- generated content streams as text chunks while preserving first-chunk output blocking behavior
- provider timeout classification returns a safe error without spending the reserved transform

## Operations

Admin diagnostics:
- `/admin/ai-governance` shows recent non-content usage events, pass/block counts, warning counts, and prompt/model/output-guard version groupings.
- The page is gated through the server-side `app_admins` allowlist.
- It must not display raw prompts, scrubbed inputs, or generated outputs.

Live smoke:

```bash
pnpm ai:smoke
```

The smoke script sends only synthetic scrubbed input, requires `ANTHROPIC_API_KEY`, preserves `[Elev 1]`, and logs only model/output-length metadata.

## Prompt Or Guard Changes

When changing prompt behavior or guard rules:
- bump `AI_PROMPT_VERSION` or `AI_OUTPUT_GUARD_VERSION` in `lib/ai/governance.ts`
- add or update synthetic fixtures
- never use real teacher/pupil content in tests
- run the focused AI tests and full verification suite before deploy
- record notable policy changes in `docs/audit.md`

## Residual Risks

- The eval baseline is synthetic and small; it is a regression tripwire, not a comprehensive safety proof.
- The output guard can produce false positives and false negatives.
- Mid-stream blocking may leave a partial response visible before the browser sees the stream error; teacher review is still mandatory.
- Streaming responses do not currently surface non-blocking guard warnings back to the browser; add a warning delivery channel if those need to appear live in the drafting panel.
- The live provider smoke test still needs to be wired into the release workflow.
- Provider timeout/cancel/error classification is route-level and should be expanded into dashboards/alerts if provider incidents become frequent.
- Teacher review remains required before copying or sending generated text.
