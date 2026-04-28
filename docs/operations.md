# Operations Runbook

Last updated: April 28, 2026.

This document covers non-billing operations: support intake, planning sync, account lifecycle, data-rights handling, security headers, accessibility checks, and performance checks. Billing-specific operations live in `docs/billing-security.md`. AI-specific operations live in `docs/ai-governance.md`.

## Admin Access

Admin routes are gated server-side by `public.app_admins`.

To grant access:

```sql
insert into public.app_admins (user_id, created_by)
values ('USER_UUID_HERE', 'ADMIN_USER_UUID_HERE');
```

The table has RLS enabled with no client policies. Admin checks use the server-side service role only. Do not add browser-readable admin flags to profiles.

Admin routes:
- `/admin/support`
- `/admin/planning-sync`
- `/admin/ai-governance`
- `/admin/account-requests`

## Support Intake

Support is a deliberate privacy exception because users can enter free text. Treat every message as potentially sensitive.

Status model:
- `new`: received and not yet triaged
- `triaged`: reviewed and ready for handling
- `in_progress`: actively being handled
- `resolved`: support work is complete
- `spam`: abusive or irrelevant message
- `redacted`: sensitive content was removed but the audit row remains
- `deleted`: content was removed and only a minimal lifecycle row remains

Privacy rules:
- Do not copy support message text into Slack, email, tickets, AI tools, or docs.
- Use `request_id` or row `id` when discussing a case.
- Redact immediately if a message contains pupil names, personnummer, health details, incident details, or pasted classroom notes.
- Route logs and notifications must not include raw support emails or message text.

Bot protection:
- `/api/support` verifies Cloudflare Turnstile when `TURNSTILE_SECRET_KEY` is configured.
- Failed Turnstile verification must not create a support row.
- Turnstile outage handling is a launch decision: disable the env var temporarily only if accepting more spam is safer than blocking support.

Triage flow:
1. Open `/admin/support?status=open`.
2. Assign the request if you will handle it.
3. Redact immediately if the request contains sensitive content.
4. Move valid cases to `in_progress`.
5. Resolve once the response or product action is complete.
6. Mark spam as `spam`; redact first if it contains personal data.

Retention:

```bash
pnpm support:retention
pnpm support:retention:repair
```

The dry-run command lists resolved/spam requests older than the cutoff. The repair command soft-deletes matching rows by replacing contact/message fields with placeholders. Do not schedule automatic deletion until the retention policy is confirmed.

Support notifications:
- `/api/support` queues a sanitized event to `OPS_ALERT_WEBHOOK_URL` when configured.
- The event may include route name, request ID, support request ID, topic, and user ID or `anonymous`.
- The event must not include message text, submitted name, submitted email, role, or school details.

## Planning Sync

Planning cloud sync is revisioned backup/sync for Pro users. It is not real-time collaborative editing.

`planning_checklists` is the current cloud state:
- one row per `user_id`, `subject_id`, and `area_id`
- server-owned `revision`
- server-owned `updated_at`
- client-provided `client_updated_at`
- `progress_map`
- `teacher_notes`

`planning_sync_conflicts` is the audit trail for rejected stale writes:
- user/scope, server revision, client base revision, and timestamps
- server/client progress maps
- note hashes and note lengths, not duplicate raw teacher notes
- resolution timestamp and strategy

Triage:
1. Open `/admin/planning-sync?filter=unresolved`.
2. Look for repeated conflicts for the same user/scope.
3. Check conflict bursts in the last 24 hours.
4. Check client timestamps that are clearly ahead of server timestamps.
5. Do not copy raw planning notes into logs, tickets, chat, or external tooling.

Common cases:
- Stale offline edit: expected when one device replays an older queue item.
- Manual resolution: the client should allow `server`, `merged`, or `local`.
- Clock drift: if `client_updated_at` is more than five minutes ahead of `updated_at`, ask the user to check device time.

Remaining planning work:
- add browser tests around offline/online conflict resolution
- add alerting for unresolved conflict spikes
- decide whether cloud-synced teacher notes need server-side sensitive-content rejection or remain an explicit storage exception

## Account Lifecycle And Data Rights

Settings exposes:
- confirmed email-change flow through Supabase Auth
- JSON account export at `/api/account/export`
- account deletion request form
- local browser-data clearing

The account export is authenticated and returns only the current user's records. It may contain planning notes and support messages because those are explicit storage exceptions. Treat exported files as sensitive.

`account_deletion_requests` records user-initiated deletion requests.

Admin route:
- `/admin/account-requests`

Before completing a deletion:
1. Verify the authenticated user ID in `account_deletion_requests`.
2. Check billing state in Stripe and local billing projection tables.
3. Preserve records required for accounting or legal retention.
4. Redact or delete support/planning content according to the agreed retention policy.
5. Delete or anonymize the Supabase Auth user only after blockers are resolved.
6. Mark the request `completed` with `handled_by` and `handled_at`.

Do not copy user comments, support messages, or planning notes into external tools.

## Security Headers

Middleware applies:
- enforced CSP with `frame-ancestors 'none'`
- per-request script nonce and `strict-dynamic`
- no script `unsafe-inline`
- Cloudflare Turnstile script allowance for contact/support challenge rendering
- `style-src 'self' 'unsafe-inline'` while the current Next.js/UI stack still emits inline styles
- CSP report-only header pointing at `/api/csp-report`
- baseline browser hardening headers
- HSTS in production only

Operational rules:
- Check `/api/csp-report` logs after adding new third-party scripts, frames, or network targets.
- Do not add broad domains such as `https:` or wildcard script sources without a documented reason.
- Keep the report-only header active as a detection channel even though the main policy is enforced.
- Remove `style-src 'unsafe-inline'` only after testing the full app without inline style violations.

## Server Action CSRF

Mutating server actions validate the request `Origin` against the forwarded host and `NEXT_PUBLIC_APP_URL`.

If valid users start seeing origin failures:
1. Check the deployment proxy's `x-forwarded-proto` and `host` headers.
2. Confirm `NEXT_PUBLIC_APP_URL` matches the public app origin exactly.
3. Look for stale custom domains or preview URLs that are not expected to submit production mutations.

Do not bypass origin checks in individual actions. Fix the deployment origin configuration instead.

## Accessibility Checks

Current coverage includes:
- public-page Playwright accessibility smoke tests
- skip link, semantic regions, and visible focus styles
- labeled form controls on public pages and support intake
- loading states that use `aria-busy` or live-region copy where long work is expected
- keyboard-reachable primary flows in the public smoke coverage

Run:

```bash
pnpm exec playwright test e2e/accessibility.spec.ts
```

Before broad launch, complete a manual pass with at least one screen reader setup such as NVDA/Firefox or VoiceOver/Safari. Pay special attention to drafting output warnings, billing/portal flows, planning sync conflict resolution, and admin tables.

## Performance Checks

The latest local production build snapshot from April 28, 2026:
- `/lektionsplanering`: 1.62 kB route bundle, 162 kB first-load JS
- `/skrivstation`: 14.2 kB route bundle, 212 kB first-load JS
- admin routes: 371-373 B route bundles, 163 kB first-load JS
- shared first-load JS: 160 kB

Planning data is lazy-loaded in the workspace, so the full curriculum dataset is not part of the first render path.

Before broad launch:
- run production build size checks after major UI changes
- capture Core Web Vitals in the deployed environment
- test the authenticated drafting and planning flows on a mid-range mobile device
- add alerting for provider/API latency if AI timeouts become visible to users

## Open Human Decisions

- Confirm retention periods for support messages and account deletion audit rows.
- Decide whether account deletion can be automated for accounts with no active billing or retention blockers.
- Decide whether cloud-synced teacher notes remain an explicit storage exception or need extra server-side screening.
- Decide whether a dedicated MFA/session management surface is required before broad launch.
