# Support Operations

Last updated: April 26, 2026.

This is the operating runbook for Skolskribenten support intake. The support inbox is a deliberate privacy exception: users can write free text, so support must treat every message as potentially sensitive.

## Admin Access

Support admin access is controlled server-side by `public.app_admins`.

To grant access, insert the Supabase user ID:

```sql
insert into public.app_admins (user_id, created_by)
values ('USER_UUID_HERE', 'ADMIN_USER_UUID_HERE');
```

The table has RLS enabled with no client policies. Admin checks are performed through the server-side service role only. Do not add browser-readable admin flags to profiles.

Admin route:
- `/admin/support`

## Status Model

- `new`: received and not yet triaged
- `triaged`: reviewed and assigned or ready for handling
- `in_progress`: actively being handled
- `resolved`: support work is complete
- `spam`: abusive or irrelevant message
- `redacted`: sensitive content was removed but the audit row remains
- `deleted`: content was removed and the row is retained only as a minimal lifecycle record

The app updates `last_status_at` whenever status changes. Terminal statuses (`resolved`, `spam`, `redacted`, `deleted`) should have `handled_at` set.

## Privacy Rules

- Do not copy support message text into Slack, email, tickets, AI tools, or docs.
- Use `request_id` or row `id` when discussing a case.
- If a message contains pupil names, personnummer, health details, incident details, or pasted raw classroom notes, redact it immediately.
- Prefer replying with a request for a sanitized description instead of working from sensitive content.
- Route logs must not include raw support email addresses or message text.

## Triage Flow

1. Open `/admin/support?status=open`.
2. Assign the request to yourself if you will handle it.
3. Redact immediately if the message contains sensitive content.
4. Move valid cases to `in_progress`.
5. Resolve once the response or product action is complete.
6. Mark spam as `spam`; redact first if it contains personal data.

## Redaction

Use "Redigera ärende" in the admin UI when a request should remain auditable but content should be removed.

The action replaces:
- `name`
- `email`
- `role`
- `message`

It sets:
- `status='redacted'`
- `redacted_at`
- `handled_at`

## Deletion

Use "Radera ärende" for data subject requests, mistaken submissions, spam with content, or cases where support no longer has a reason to retain the message.

This is a soft deletion that removes the message/contact content and keeps a minimal row for auditability. Physical deletion can be done later by a controlled database maintenance job after legal/business retention is confirmed.

## Retention Policy

Current conservative operating policy:
- Redact or soft-delete sensitive submissions as soon as they are identified.
- Review resolved/spam support requests at least monthly.
- Soft-delete resolved/spam requests older than 90 days unless there is an active billing, legal, abuse, or product-investigation reason to retain them.

Dry-run candidates:

```bash
pnpm support:retention
```

Apply soft deletion:

```bash
pnpm support:retention:repair
```

Optional flags:
- `--days=120` changes the retention window.
- `--limit=100` caps the number of rows processed in one run.

The job only selects `resolved` and `spam` rows where `deleted_at is null` and `last_status_at` is older than the cutoff. It replaces contact/message fields with placeholders and keeps the row for auditability.

This policy still needs human confirmation before scheduling automatic deletion.

## Notifications

When `/api/support` stores a new request, it queues a sanitized info event to `OPS_ALERT_WEBHOOK_URL` if configured.

The event may include:
- route name
- request ID
- support request ID
- topic
- user ID or `anonymous`

It must not include:
- support message text
- submitted name
- submitted email
- role/school details

## Investigating Support Bugs

1. Start from `request_id`.
2. Check `support_requests.status`, `assigned_to`, `handled_at`, `redacted_at`, `deleted_at`, and `last_status_at`.
3. Check server logs by request ID, not by email or message text.
4. If storage failed, inspect `/api/support` route errors and `OPS_ALERT_WEBHOOK_URL` delivery.
5. If sensitive content was stored, redact it first, then investigate how it bypassed detection.

## Incident Notes

Support intake is not a place to store school documentation. If a user submits sensitive pupil data:
- redact the request
- reply with sanitized guidance if contact details remain available elsewhere
- record the incident by request ID only
- add a regression test if the sensitive-content pattern should have been caught automatically
