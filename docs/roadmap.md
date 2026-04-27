# Roadmap

Last updated: April 27, 2026.

This is the short operational roadmap. `docs/audit.md` is the detailed current risk register.

## Phase A: Privacy And Data Lifecycle

Landed:
- support warnings and server-side sensitive-content rejection
- lifecycle columns and hashed route logs
- clear-all local data and sign-out cleanup
- Settings privacy copy and planning import/export guardrails

Remaining:
- local autosave setting
- confirmed support retention schedule
- final cloud-sync policy for planning teacher notes

## Phase B: Support And Operations

Landed:
- server-side `app_admins` allowlist
- `/admin/support` queue with status filters, assignment, redaction, and soft deletion
- sanitized support intake notifications through `OPS_ALERT_WEBHOOK_URL`
- dry-run-first support retention tooling
- consolidated operations runbook in `docs/operations.md`

Remaining:
- validate deployed alert delivery
- schedule retention automation after human policy approval
- add abuse dashboard or aggregate support intake metrics

## Phase C: Planning Sync Reliability

Landed:
- server-owned revisions
- conditional writes and conflict audit rows
- client replay queue support for revisions, conflict IDs, timestamps, and resolution strategy
- `/admin/planning-sync` diagnostics without raw teacher notes

Remaining:
- browser-flow tests for offline/online conflict resolution
- deployed migration verification
- alerting for unresolved conflict spikes
- final teacher-note cloud-storage policy

## Phase D: AI Quality And Safety

Landed:
- `usage_events` AI provider/model/prompt/guard metadata
- server-side output guard before returning generated text
- blocked-output quota release
- synthetic eval coverage
- provider timeout/error classification
- synthetic `pnpm ai:smoke`
- `/admin/ai-governance` diagnostics without raw content

Remaining:
- expand the golden/red-team suite
- wire smoke tests into release automation
- add alerting for guard failure spikes
- add teacher feedback/report-without-content workflow

## Phase E: Account And Security Maturity

Landed:
- confirmed email-change flow
- authenticated account JSON export
- admin-tracked account deletion requests
- `/admin/account-requests`
- reduced registration enumeration
- middleware protection for `/admin`
- CSP `frame-ancestors 'none'`, report-only telemetry, and production HSTS

Remaining:
- decide whether deletion can be automated for accounts without billing/retention blockers
- add session/device visibility or MFA if needed
- add app-level auth throttling if Supabase controls are insufficient
- move CSP toward nonce/hash enforcement
- complete manual accessibility and live auth-security sign-off
