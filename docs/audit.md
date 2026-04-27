# Production Audit

Last updated: April 27, 2026.

This audit reflects the current repository after the billing hardening work and the non-billing Phase A-E improvements. It is the active risk register, not an archive of older prompts.

Canonical deep docs:
- `docs/billing-security.md` for Stripe, entitlement, webhook, portal, and reconciliation behavior.
- `docs/ai-governance.md` for AI prompt/guard/eval operations.
- `docs/operations.md` for support, planning sync, account lifecycle, and security-header runbooks.
- `docs/roadmap.md` for the short phase map.

## Current Readiness

| Area | Status | Notes |
| --- | --- | --- |
| Billing and entitlements | Strong local design, live sign-off pending | Stripe is the payment source of truth. Local state is a durable projection with idempotent webhooks, event ledger, customer mapping, and reconciliation. Live Stripe test-mode verification is still required. |
| Drafting privacy | Strong baseline | Drafting raw notes and generated output are not stored. Browser and server scrubbing plus output guard are in place. Teacher review remains required. |
| Planning sync | Improved, not final | Revisioned backup/sync and conflict audit exist. Browser offline/online flow tests and conflict alerting are still needed. |
| Support operations | Improved, not final | Admin triage, redaction, soft deletion, sanitized alerts, and retention tooling exist. Deployed alert validation and scheduled retention remain. |
| AI safety and operations | Improved, not final | Usage metadata, output guard, provider error classification, synthetic evals, smoke script, and admin diagnostics exist. Red-team coverage and alerting need expansion. |
| Account lifecycle | Improved, not final | Email change, JSON export, deletion requests, and admin visibility exist. Account deletion still needs policy and execution decisions. |
| Security headers/admin protection | Improved, not final | `/admin` is middleware-protected, CSP frame blocking and report-only telemetry exist, and HSTS is production-only. CSP nonce/hash enforcement is future work. |
| Launch readiness | Not ready for broad production | Remaining blockers are mostly live verification, retention policy, accessibility/manual QA, alerting, and operational drills. |

## What Is Working Now

- Paid access cannot be granted by success redirects alone.
- Checkout and portal routes are authenticated and server-owned.
- Stripe webhook handling verifies signatures, persists events, handles duplicates, and models subscription terminal states.
- Entitlement checks rely on `account_entitlements` rather than stale profile fields.
- Planning sync no longer depends on timestamp-only conflict detection.
- Support requests can be triaged, assigned, redacted, soft-deleted, and retained under a dry-run-first script.
- AI generated text is assembled server-side and checked before response delivery.
- AI provider failures are classified into safer client responses.
- Admin diagnostics exist for support, planning conflicts, AI governance, and account deletion requests.
- Account export is authenticated and scoped to the current user.
- Registration messaging no longer confirms that an email is already registered.

## Highest Priority Risks

### 1. Live Production Sign-Off Is Still Incomplete

The code has strong local coverage, but production readiness depends on live environment behavior:
- Supabase migrations through `019_account_lifecycle_security.sql`
- Stripe test-mode checkout, webhook replay, portal, subscription cancellation, and reconciliation
- deployed `OPS_ALERT_WEBHOOK_URL` delivery
- deployed CSP report collection
- production security headers
- manual auth, account, billing, planning sync, and support smoke tests

Until those checks are completed, the app should remain in controlled pilot mode.

### 2. Retention And Account Deletion Need Human Policy

The app can collect support messages and cloud-synced planning notes. It also accepts account deletion requests, but deletion is not automated because billing, legal/accounting retention, support history, and planning data can conflict.

Needed decisions:
- retention period for support messages
- retention period for account deletion audit rows
- whether planning notes remain an explicit storage exception
- whether low-risk deletion requests can be automated
- who is authorized to complete irreversible deletions

### 3. AI Governance Needs Broader Operational Coverage

The AI guardrails are materially stronger, but the eval suite is still synthetic and small. A production-ready workflow needs more non-real-data adversarial fixtures, release automation, alerting for guard failure spikes, and a teacher feedback path that does not store raw generated text.

### 4. Planning Sync Needs Browser-Level Failure Testing

The server model is revisioned and conflict-aware, but browser behavior under offline, replay, tab duplication, conflict resolution, and clock drift still needs end-to-end tests. This matters because planning notes are a deliberate storage exception.

### 5. Support Intake Is Safer, But Abuse Operations Are Thin

Support now has privacy-aware triage and retention tooling. The remaining gap is operational: deployed alerts, scheduled retention, aggregate abuse metrics, and a clear incident drill for sensitive-content submissions.

### 6. Security Headers Are Not Yet At Strict CSP

The app blocks framing and collects CSP reports, but still uses report-only telemetry for tightening script/style policy. Strict nonce/hash CSP should wait for staging evidence so the app is not broken by a premature policy.

## Missing Capabilities Before Broad Launch

- Full live Stripe test matrix and webhook replay runbook rehearsal.
- Confirmed support/account deletion retention policy.
- Browser tests for planning sync conflict resolution.
- Accessibility pass on marketing, auth, dashboard, settings, support, planning, and admin routes.
- Release smoke checklist that includes billing, AI, support, account export, and planning sync.
- Alerting for Stripe webhook failures, support intake, AI provider failures, guard blocks, and planning conflict spikes.
- Backup/restore and incident-response rehearsal for Supabase data.

## Phased Plan

### Phase 1: Launch Gate

- Apply and verify migrations through `019_account_lifecycle_security.sql` in staging.
- Run full Stripe test-mode checkout, portal, cancellation, async/failure, webhook replay, and reconciliation.
- Validate all required environment variables and fail-closed behavior in staging.
- Run manual auth/account/security smoke tests, including account export and deletion request creation.
- Run accessibility and mobile viewport checks for the core user flows.
- Confirm production logging does not include secrets, payment details, raw support messages, planning notes, or generated output.

### Phase 2: Operations Automation

- Validate `OPS_ALERT_WEBHOOK_URL` delivery in deployed environments.
- Schedule support retention only after retention policy approval.
- Add alerts for webhook failures, AI provider failures, guard failure spikes, and planning conflict spikes.
- Add a concise release checklist to the deploy process.
- Rehearse backup restore and incident response.

### Phase 3: Product Reliability

- Add browser-level tests for planning sync offline/replay/conflict resolution.
- Expand AI golden and red-team fixtures with synthetic data only.
- Add teacher feedback/reporting without storing raw generated text.
- Improve support abuse visibility with aggregate metrics.
- Decide whether local autosave should be user-configurable.

### Phase 4: Security Maturity

- Move CSP from report-only tightening toward nonce/hash enforcement.
- Decide whether to add MFA or session/device visibility.
- Add app-level auth throttling if Supabase controls are insufficient for the launch profile.
- Automate safe account deletion for accounts without billing or retention blockers, if approved.

## Current Verification Baseline

Most recent local verification before this docs cleanup:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `git diff --check`
- `node --check scripts/ai-smoke.mjs`

`pnpm ai:smoke` is intentionally manual because it calls the live Anthropic API and requires configured secrets.

## Documentation Cleanup

Removed from active docs:
- the old design prompt placeholder
- the audit-agent prompt archive
- separate support, planning sync, and account-security operation files now merged into `docs/operations.md`
- extensionless `docs/roadmap`, replaced by `docs/roadmap.md`

The active docs set is intentionally small. Add new docs only when they are operationally useful and can be kept current.

## Residual Risk

No documentation or guardrail can prove the app impossible to misuse. The remaining practical risk is concentrated in live-environment configuration, human retention decisions, and operational response quality. The system is much harder to abuse than the original MVP, but it should remain in controlled pilot mode until Phase 1 is complete.
