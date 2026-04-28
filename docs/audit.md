# Production Audit

Last updated: April 28, 2026.

This is the active production-readiness risk register. Completed phase logs have been folded back into this document and removed from the active docs set.

Canonical docs:
- `docs/billing-security.md` for Stripe, entitlements, webhook, portal, and reconciliation behavior.
- `docs/ai-governance.md` for prompt, streaming, output guard, eval, and AI operations.
- `docs/operations.md` for support, planning sync, account lifecycle, data rights, security headers, accessibility, and performance runbooks.
- `docs/roadmap.md` for the short phase map.

## Current Readiness

| Area | Status | Notes |
| --- | --- | --- |
| Billing and entitlements | Strong local design, live sign-off pending | Stripe is the payment source of truth. Local state is a durable projection with idempotent webhooks, event ledger, customer mapping, reconciliation, 7-day `past_due` grace, and runtime display pricing. Live Stripe verification is still required. |
| Drafting privacy | Strong baseline | Raw notes and generated output are not stored. Browser and server scrubbing, per-user safe capitalized words, sensitive-content rejection, and output guard are in place. Teacher review remains required. |
| Planning sync | Improved, not final | Revisioned backup/sync and conflict audit exist. Browser offline/online, replay, tab duplication, and conflict-resolution tests are still needed. |
| Support operations | Improved, not final | Admin triage, redaction, soft deletion, Turnstile protection, sanitized alerts, and retention tooling exist. Deployed alert validation and scheduled retention remain. |
| AI safety and operations | Improved, not final | Streaming generation, usage metadata, output guard, provider error classification, synthetic evals, smoke script, and admin diagnostics exist. Red-team coverage and alerting need expansion. |
| Account lifecycle | Improved, not final | Email change, JSON export, local data clearing, deletion requests, and admin visibility exist. Account deletion still needs policy and execution decisions. |
| Security and auth | Improved, not final | Admin routes are middleware-protected and server-allowlisted. CSP uses per-request script nonces, server actions validate `Origin`, password creation/update checks HaveIBeenPwned, and HSTS is production-only. MFA/session visibility and app-level auth throttling remain decisions. |
| Accessibility and performance | Improved, not final | Public accessibility smoke coverage exists, core focus/labels were reviewed, and planning workspace is lazy-loaded. Live assistive-technology review and bundle monitoring remain. |
| Launch readiness | Controlled pilot only | Remaining blockers are mostly live verification, retention policy, alerting, browser failure tests, and operational drills. |

## Highest Priority Risks

### 1. Live Production Sign-Off Is Still Incomplete

The code has strong local coverage, but production readiness depends on deployed behavior:
- Supabase migrations through the current schema.
- Stripe test-mode checkout, webhook replay, portal, subscription cancellation, async/failure flows, and reconciliation.
- deployed `OPS_ALERT_WEBHOOK_URL` delivery.
- deployed CSP report collection.
- production security headers.
- manual auth, account, billing, planning sync, support, accessibility, and mobile smoke tests.

Until those checks are completed, the app should remain in controlled pilot mode.

### 2. Retention And Account Deletion Need Human Policy

The app can collect support messages and cloud-synced planning notes. It also accepts account deletion requests, but deletion is not automated because billing, legal/accounting retention, support history, and planning data can conflict.

Needed decisions:
- retention period for support messages.
- retention period for account deletion audit rows.
- whether planning notes remain an explicit storage exception.
- whether low-risk deletion requests can be automated.
- who is authorized to complete irreversible deletions.

### 3. Planning Sync Needs Browser-Level Failure Testing

The server model is revisioned and conflict-aware, but browser behavior under offline, replay, tab duplication, conflict resolution, and clock drift still needs end-to-end tests. This matters because planning notes are a deliberate storage exception.

### 4. Operational Alerting Is Thin

Support, Stripe, AI, CSP, and planning sync all have safer logging patterns, but broad launch needs deployed alert validation and practical incident drills.

Needed alerts:
- Stripe webhook failures and repeated retries.
- AI provider failures and output-guard block spikes.
- support intake spikes, Turnstile failures, and sensitive-content submissions.
- unresolved planning conflict spikes.
- CSP report spikes after deploys.

### 5. AI Governance Needs Broader Coverage

The guardrails are materially stronger, but the eval suite is still synthetic and small. A production-ready workflow needs more non-real-data adversarial fixtures, release automation, alerting, and a teacher feedback path that does not store raw generated text.

## Missing Capabilities Before Broad Launch

- Full live Stripe test matrix and webhook replay runbook rehearsal.
- Confirmed support/account deletion retention policy.
- Browser tests for planning sync conflict resolution and replay.
- Live assistive-technology pass on marketing, auth, dashboard, settings, support, planning, and admin routes.
- Release smoke checklist that includes billing, AI, support, account export, CSP reports, and planning sync.
- Alerting for Stripe webhook failures, support intake, AI provider failures, guard blocks, CSP reports, and planning conflict spikes.
- Backup/restore and incident-response rehearsal for Supabase data.

## Phased Plan

### Phase 1: Launch Gate

- Apply and verify all Supabase migrations in staging.
- Run full Stripe test-mode checkout, portal, cancellation, async/failure, webhook replay, and reconciliation.
- Validate all required environment variables and fail-closed behavior in staging.
- Run manual auth/account/security smoke tests, including account export and deletion request creation.
- Run accessibility and mobile viewport checks for the core user flows.
- Confirm production logs do not include secrets, payment details, raw support messages, planning notes, or generated output.

### Phase 2: Operations Automation

- Validate `OPS_ALERT_WEBHOOK_URL` delivery in deployed environments.
- Schedule support retention only after retention policy approval.
- Add alerts for webhook failures, AI provider failures, guard failure spikes, CSP report spikes, and planning conflict spikes.
- Add a concise release checklist to the deploy process.
- Rehearse backup restore and incident response.

### Phase 3: Product Reliability

- Add browser-level tests for planning sync offline/replay/conflict resolution.
- Expand AI golden and red-team fixtures with synthetic data only.
- Add teacher feedback/reporting without storing raw generated text.
- Improve support abuse visibility with aggregate metrics.
- Decide whether local autosave should be user-configurable.

### Phase 4: Security Maturity

- Decide whether to add MFA or session/device visibility.
- Add app-level auth throttling if Supabase controls are insufficient for the launch profile.
- Automate safe account deletion for accounts without billing or retention blockers, if approved.
- Keep CSP report collection under review before adding more third-party scripts.

## Current Verification Baseline

Most recent local verification:
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec playwright test e2e/accessibility.spec.ts`

`pnpm ai:smoke` is intentionally manual because it calls the live Anthropic API and requires configured secrets.

## Residual Risk

No documentation or guardrail can prove the app impossible to misuse. The remaining practical risk is concentrated in live-environment configuration, human retention decisions, and operational response quality. The system is much harder to abuse than the original MVP, but it should remain in controlled pilot mode until Phase 1 is complete.
