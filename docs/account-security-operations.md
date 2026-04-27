# Account Security Operations

Last updated: April 27, 2026.

This document covers account lifecycle controls outside Stripe billing.

## User Controls

Settings now exposes:
- confirmed email-change flow through Supabase Auth
- JSON account export at `/api/account/export`
- account deletion request form
- local browser-data clearing

The export is authenticated and returns only the current user's records. It can contain planning notes and support messages because those are explicit storage exceptions, so users and operators must handle the file as sensitive.

## Deletion Requests

`account_deletion_requests` records user-initiated deletion requests.

The app does not instantly delete accounts because deletion can interact with:
- active Stripe subscriptions or historical billing records
- support-message retention
- planning cloud-sync content
- legal/accounting retention requirements

Admin visibility:
- `/admin/account-requests`

Before completing a deletion:
1. Verify the authenticated user ID in `account_deletion_requests`.
2. Check billing state in Stripe and local billing projection tables.
3. Export or preserve any records required for accounting/legal retention.
4. Redact or delete support/planning content according to the agreed retention policy.
5. Delete or anonymize the Supabase Auth user only after the above is resolved.
6. Mark the request `completed` with `handled_by` and `handled_at`.

Do not copy user comments, support messages, or planning notes into external tools.

## Security Header Rollout

Middleware now applies:
- enforced CSP with `frame-ancestors 'none'`
- CSP report-only header pointing at `/api/csp-report`
- baseline browser hardening headers
- HSTS in production

Use report-only findings to remove unsafe inline allowances gradually. Do not jump to nonce/hash enforcement until Next.js runtime behavior and third-party scripts have been tested in staging.

## Remaining Human Decisions

- Confirm the final retention period for support messages and account deletion audit rows.
- Decide whether account deletion should eventually become fully automated for accounts with no active billing or retention blockers.
- Decide whether a dedicated MFA/security settings surface is needed before broad launch.
