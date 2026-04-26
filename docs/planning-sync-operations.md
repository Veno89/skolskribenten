# Planning Sync Operations

Last updated: April 26, 2026.

Planning cloud sync is revisioned backup/sync for Pro users. It is not real-time collaborative editing.

## Admin Access

Planning sync admin access uses the same server-side `public.app_admins` allowlist as support admin.

Admin route:
- `/admin/planning-sync`

The route uses the service-role client on the server only. Do not expose admin flags or conflict details directly to browser clients through RLS policies.

## State Model

`planning_checklists` is the current cloud state:
- one row per `user_id`, `subject_id`, and `area_id`
- `revision` is server-owned and increments on every accepted write
- `updated_at` is server-owned
- `client_updated_at` records the client edit timestamp for display and conflict context
- `progress_map` stores checklist status
- `teacher_notes` stores the user's planning notes

`planning_sync_conflicts` is the audit trail for rejected stale writes:
- stores user/scope, server revision, client base revision, and timestamps
- stores server/client progress maps
- stores note hashes and note lengths, not duplicate raw teacher notes
- marks `resolved_at` and `resolution_strategy` when the client replays a chosen resolution

## Triage

Use `/admin/planning-sync?filter=unresolved` for the first pass.

Investigate:
- repeated unresolved conflicts for the same user/scope
- conflict bursts in the last 24 hours
- client timestamps that are clearly ahead of server timestamps
- rows with unexpectedly high revision churn

Do not copy raw planning notes into logs, tickets, chat, or external tooling. The admin view intentionally shows counts, timestamps, revision numbers, and note hash prefixes instead of note content.

## Common Cases

Stale offline edit:
- Expected when a teacher edits on one device, then another device replays an older queue item.
- The server rejects the stale write and records a conflict.
- The client should present server, merged, and local choices.

Manual resolution:
- `server` keeps the server state.
- `merged` writes the merged state against the current server revision.
- `local` writes the local state against the current server revision.
- All strategies should clear the queued conflict after replay succeeds.

Clock drift:
- If `client_updated_at` is more than five minutes ahead of `updated_at`, ask the user to check device time before treating it as data loss.

## Runbook

1. Confirm migrations through `017_revisioned_planning_sync.sql` are applied.
2. Open `/admin/planning-sync?filter=unresolved`.
3. Check whether conflicts cluster by user, subject, or browser/device.
4. For a single user report, compare the relevant `planning_checklists` row revision with the latest conflict's `server_revision`.
5. Ask the user to resolve the in-app conflict. Avoid manual database edits unless the user cannot access the app.
6. If manual repair is necessary, update only the scoped `planning_checklists` row, increment `revision`, set `updated_at = now()`, and document the action in the incident notes without raw teacher notes.
7. If conflict rows keep appearing after resolution, treat it as a client replay bug and preserve the conflict IDs for debugging.

## Remaining Work

- Add browser-level tests around offline/online conflict resolution once a DOM/browser test harness is added.
- Add alerting for unresolved conflict spikes.
- Decide the final product policy for whether cloud-synced teacher notes need server-side sensitive-content rejection or remain an explicitly documented storage exception.
