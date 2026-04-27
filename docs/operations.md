# Operations Runbook

Last updated: April 27, 2026.

This document covers non-billing operations: support intake, planning sync, account lifecycle, data-rights handling, and security-header rollout. Billing-specific operations live in `docs/billing-security.md`. AI-specific operations live in `docs/ai-governance.md`.

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
- CSP report-only header pointing at `/api/csp-report`
- baseline browser hardening headers
- HSTS in production

Use report-only findings to remove unsafe inline allowances gradually. Do not move to nonce/hash enforcement until Next.js runtime behavior and third-party scripts have been tested in staging.

## Open Human Decisions

- Confirm retention periods for support messages and account deletion audit rows.
- Decide whether account deletion can be automated for accounts with no active billing or retention blockers.
- Decide whether cloud-synced teacher notes remain an explicit storage exception or need extra server-side screening.
- Decide whether a dedicated MFA/session management surface is required before broad launch.
