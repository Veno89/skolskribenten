# Audit
This is a production-readiness assessment of the live Skolskribenten repository. The first full pass was completed on April 23, 2026, with focused billing hardening and a deeper non-billing product/security audit added on April 26, 2026.

## April 26, 2026 Billing Security Hardening Addendum
The account, subscription, Stripe Checkout, portal, webhook, and entitlement flow has now been hardened as financial/security-critical infrastructure. The detailed state machine, threat model, runbooks, and residual risks live in `docs/billing-security.md`.

Implemented:
- durable Stripe customer, checkout session, subscription, entitlement, and event-ledger tables in `supabase/migrations/013_billing_hardening.sql`
- authoritative entitlement backfill, signup defaults, stale webhook-event reclamation, and Stripe-object identity checks in `supabase/migrations/014_authoritative_entitlement_hardening.sql`
- uniqueness constraints for user/customer mappings, Checkout Session IDs, Subscription IDs, and Stripe Event IDs
- transactional RPCs for customer mapping, event claiming/completion, checkout projection, subscription projection, and profile projection syncing
- Checkout, portal, cloud sync, and generation quota now read `account_entitlements` instead of trusting stale `profiles` projection fields
- durable webhook event payload storage now keeps a sanitized Stripe object summary rather than full customer/payment details
- server-owned Stripe price allowlist/config validation with fail-fast missing/malformed key handling
- Stripe idempotency keys for customer, checkout, and portal POST operations
- Checkout fulfillment through verified webhooks and Stripe-retrieved objects instead of redirect state
- subscription state behavior for `trialing`, `active`, `past_due`, `unpaid`, `canceled`, `paused`, `incomplete`, and `incomplete_expired`
- strict no-grace `past_due` policy pending business confirmation
- centralized entitlement decision helpers in `lib/billing/entitlements.ts`
- account-page technical payment state visibility for local entitlement reason, Stripe IDs, last event, and reconciliation time
- reconciliation tooling via `pnpm billing:reconcile` and `pnpm billing:reconcile:repair`

Verified locally on April 26, 2026:
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Result:
- all three checks passed
- the test suite is currently at 158 passing tests

Remaining launch gates:
- apply migrations `013_billing_hardening.sql` and `014_authoritative_entitlement_hardening.sql` to the target Supabase environment
- run live Stripe test-mode checkout, async-payment, portal, cancellation, and webhook replay verification
- confirm whether strict immediate revocation for `past_due` is the desired business policy

## April 26, 2026 Non-Billing Product And Security Audit Addendum
Scope reviewed:
- AI generation route, prompt construction, model/provider configuration, stream handling, quota reservation, and usage-event recording.
- GDPR scrubber, server-side sensitive-content guard, document parser/renderer, and copy-to-clipboard flow.
- Drafting workspace, local draft persistence, sign-out storage clearing, planning workspace, planning cloud sync, conflict queue, import/export, and direct planning generation.
- Public support/contact intake, abuse controls, support database table, operational logging, and alert sanitization.
- Auth actions, password policy, settings/account profile update flow, protected route middleware, security headers, legal/FAQ/contact copy, README, roadmap, and historical design docs.
- Non-billing tests for AI, GDPR, support, planning, auth policy, middleware, request context, and storage helpers.

Phase A implementation update:
- Support submissions now run a server-side sensitive-content check before storage, reject obvious names/personnummer/contact details, store request IDs and lifecycle status fields, and avoid raw email addresses in route-level duplicate/rate-limit logs.
- `supabase/migrations/015_support_privacy_lifecycle.sql` adds support request status, owner, handled/redacted/deleted timestamps, request IDs, indexes, and a status timestamp trigger.
- Sign-out and Settings now share a clear-all local data utility for drafts, planning checklist state, planning sync queues, and onboarding state.
- Planning import/export now has file-size, entry-count, and teacher-note length guardrails plus an explicit warning that exports can contain planning notes.

Phase B implementation update:
- `supabase/migrations/016_support_admin_operations.sql` adds a server-side `app_admins` allowlist for privileged support operations.
- `/admin/support` now provides an admin-gated support queue with open/status filters, assignment, status updates, redaction, and soft deletion.
- Support destructive actions require explicit confirmation and replace stored message/contact content with placeholders instead of spreading it into logs or external tools.
- New support intake can emit a sanitized info event to `OPS_ALERT_WEBHOOK_URL` without submitted name, email, role, or message text.
- `pnpm support:retention` and `pnpm support:retention:repair` provide dry-run-first soft deletion for resolved/spam support rows older than the retention cutoff.
- `docs/support-operations.md` now defines admin access, status meanings, triage, redaction, deletion, retention, and incident handling.

### Highest-Priority Findings
#### 1. Support intake can become an accidental sensitive-content database
Severity: High

Why it matters:
The product promise is strongest when teacher-written content stays out of durable storage. The support form is a necessary exception, and the server now rejects obvious sensitive content before storage. It still needs a complete operational lifecycle: triage UI, retention execution, deletion/redaction workflow, and incident runbook.

Evidence:
- `app/api/support/route.ts` stores `name`, `email`, `role`, `topic`, `message`, request ID, status, and optional `user_id` through the admin client after schema, honeypot, rate-limit, duplicate, and sensitive-content checks.
- `supabase/migrations/015_support_privacy_lifecycle.sql` adds lifecycle fields and status timestamp handling, but no automated retention job or admin triage surface exists yet.
- `components/shared/ContactForm.tsx` and `app/kontakt/page.tsx` include user-facing warnings not to paste pupil names or full raw documentation.
- Duplicate/rate-limit logs now use a hashed email value, but support operators still need an admin-safe lookup and redaction workflow.

Fix direction:
- Keep the support-copy warnings and server-side sensitive-content test coverage from regressing.
- Build the support triage/admin flow around the new status, owner, handled, redacted, deleted, and request ID fields.
- Add a retention job/runbook and admin-only support workflow. Until then, support storage is an operational liability.
- Keep raw support email addresses out of route logs; use `user_id`, request ID, hashed email, or coarse counters.

#### 2. The local/browser data lifecycle is not yet strong enough for school/shared-device reality
Severity: High

Why it matters:
The app avoids storing drafting content in the database, but it still stores teacher-written material in browser storage. Drafting notes live in `localStorage` for up to 12 hours. Planning notes, sync queue entries, onboarding state, and planning export/import payloads can also live on the device. The new clear-all control reduces shared-device risk, but the lifecycle still needs an autosave setting and a clearer retention contract.

Evidence:
- `hooks/useDraftPersistence.ts` persists raw drafting input and custom names in `localStorage`.
- `components/auth/SignOutButton.tsx` now clears draft, planning checklist, planning sync queue, and onboarding storage through `lib/privacy/local-data.ts`.
- `hooks/usePlanningChecklist.ts` stores `teacherNotes` and sync queues in `localStorage`.
- `app/api/planning/checklist/route.ts` stores Pro cloud-sync `teacher_notes` in `planning_checklists`.
- `lib/planning/checklist-storage.ts` now caps planning import size, export/import entry count, and teacher-note length; `components/planning/PlanningWorkspace.tsx` warns that exports may contain planning notes.

Fix direction:
- Keep the single "clear all local data" utility covering draft, planning, sync queue, and onboarding keys wired to sign-out and Settings.
- Add local autosave on/off controls and deepen the Settings privacy copy around planning cloud sync.
- Add planning local-data TTL or explicit "keep until cleared" copy.
- Keep import size limits, safer parse errors, and export warnings covered by tests.
- Decide whether planning teacher notes should be scrubbed/rejected before cloud sync, or whether the feature is explicitly allowed to store teacher notes under a documented policy.

#### 3. Planning cloud sync is useful, but not yet a reliable synchronization system
Severity: High

Why it matters:
Teachers will read "cloudsync" as dependable cross-device state. The current implementation is a best-effort last-timestamp flow with heuristic merging. It is good MVP work, but it does not yet provide server-authored revisions, idempotency, conflict history, or deterministic convergence under races.

Evidence:
- `app/api/planning/checklist/route.ts` trusts client-supplied `updatedAt` and only detects conflicts when the existing server timestamp is newer.
- `lib/planning/cloud-merge.ts` merges checklist status by "highest status wins" and concatenates notes with a divider.
- `hooks/usePlanningChecklist.ts` maintains a client-side queue in browser storage and replays it sequentially, but the server does not enforce revision tokens or optimistic-lock preconditions.
- `planning_checklists.updated_at` is both client-written and touched by the database trigger, which makes the semantic meaning of the timestamp easy to misunderstand.

Fix direction:
- Add server-generated `revision` or `version` and require clients to send `baseRevision`.
- Move conflict detection into a transactional RPC or conditional update.
- Store conflict/audit rows for rejected writes and manual resolutions.
- Make `updated_at` server-owned and separate it from client-observed edit timestamps.
- Adjust product copy: "best-effort backup/sync" until the versioned model exists.

#### 4. AI safety is mostly prompt-and-scrubber based, with no evaluation harness or post-generation guard
Severity: Medium-High

Why it matters:
The AI route is much safer than a pass-through endpoint, but production quality for a school documentation assistant depends on repeatable output evaluation. The current system blocks obvious sensitive input before generation, but it streams model output directly to the browser and does not test a golden/red-team suite for hallucinations, unsafe phrasing, missed placeholders, or policy drift.

Evidence:
- `app/api/ai/route.ts` re-scrubs input and blocks likely sensitive content before calling Anthropic.
- The response is streamed to the browser chunk by chunk before any post-generation inspection.
- `lib/ai/prompts.ts` contains strong instructions, but there is no prompt-version field on usage events, no golden output fixture set, and no automated checks for placeholder preservation or unsupported factual additions.
- `lib/ai/provider.ts` hardcodes the primary model. There is no deployed smoke check proving the configured model remains available in each environment.

Fix direction:
- Add prompt/model version metadata to `usage_events`.
- Build a small offline eval suite with red-team inputs for names, personnummer, mixed Swedish names, incident reports, and planning notes.
- Add post-generation validation for obvious identifiers and placeholder drift before copy/export actions, or at least a warning state for suspicious output.
- Add provider timeout/abort handling and cost/error classification.
- Add a live AI smoke test to the release checklist using synthetic scrubbed content only.

#### 5. Account lifecycle and user data rights are still incomplete outside billing
Severity: Medium-High

Why it matters:
The basic auth flows work, but a teacher-facing product needs predictable account recovery, data export/deletion, session visibility, and email-change handling. These are not luxuries once the app stores account metadata, planning state, support requests, billing identifiers, and usage metadata.

Evidence:
- `app/(auth)/actions.ts` has login, registration, confirmation resend, password reset, password update, and sign-out flows.
- `components/dashboard/settings/SettingsPageContent.tsx` only updates name, school, school level, and tone.
- There is no self-service email change flow, account deletion flow, profile export, planning export from the server, support request deletion request workflow, MFA setting, or session/device list.
- Registration still returns a specific "already registered" message, which is helpful UX but allows account existence probing.

Fix direction:
- Add self-service account deletion and data export runbooks before broad launch.
- Add email-change flow or explicitly document that support must handle it.
- Decide whether account enumeration in registration is acceptable; if not, make signup responses less specific.
- Add app-level throttling around auth-related server actions if Supabase platform limits are not enough for the intended launch.
- Track live Supabase security settings, including leaked-password protection availability, as part of release sign-off.

#### 6. Security headers are good baseline, not hardened final state
Severity: Medium

Why it matters:
Middleware applies useful baseline headers, but the production CSP still allows inline scripts/styles and has no reporting loop. This is common in early Next.js apps, but it is not the posture to stop at for a privacy-sensitive app.

Evidence:
- `lib/supabase/middleware.ts` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and CSP.
- Production `script-src` still includes `'unsafe-inline'`; `style-src` includes `'unsafe-inline'`.
- There is no `Content-Security-Policy-Report-Only`, report endpoint, `frame-ancestors`, `upgrade-insecure-requests`, or repo-visible HSTS policy.

Fix direction:
- Add CSP report-only mode first, then move toward nonce/hash-based scripts if feasible.
- Add `frame-ancestors 'none'` to CSP in addition to `X-Frame-Options`.
- Decide whether HSTS is set at the hosting edge. If not, add it in middleware for production.
- Add tests that assert the intended production CSP shape.

#### 7. Operational visibility is improving, but still not full incident readiness
Severity: Medium

Why it matters:
Request IDs and sanitized operational alerts are a good foundation. The app still lacks client-side error monitoring, support triage visibility, AI/provider health metrics, planning-sync drift dashboards, release smoke automation, and documented ownership for incidents outside billing.

Evidence:
- `lib/server/request-context.ts` adds request IDs and structured logs.
- `lib/server/operational-alerts.ts` can forward sanitized route errors through `OPS_ALERT_WEBHOOK_URL`.
- There is no Sentry/OpenTelemetry-style client capture, admin support view, AI failure dashboard, or post-deploy smoke workflow.

Fix direction:
- Wire `OPS_ALERT_WEBHOOK_URL` in staging/production and test it deliberately.
- Add client error monitoring with strict PII scrubbing.
- Add admin/debug surfaces for support requests, AI failures, planning sync conflicts, and account/data-deletion requests.
- Add smoke tests for auth, AI generation, support validation, planning sync, and billing portal creation.

### Missing Capabilities For This App Category
- Privacy controls: local autosave setting, deeper planning cloud-sync storage policy, export/delete account data, support-message deletion request flow. A clear-all local data path now exists.
- AI governance: prompt/model versioning, golden evals, red-team cases, output warnings, teacher feedback/rating, issue-report-without-content workflow.
- Support operations: deployed notification validation, scheduled retention automation, abuse dashboard, and broader incident runbooks. A minimal admin queue, status/owner fields, redaction/deletion actions, sanitized notifications, retention tooling, and support PII runbook now exist.
- Planning reliability: revisioned sync, server-owned timestamps, deterministic conflict handling, conflict audit history, import/export guardrails.
- Account management: email change, account deletion, data export, session/device visibility, optional MFA/security settings.
- Release confidence: staging smoke tests, production smoke tests, accessibility record, live AI provider smoke, uptime/error monitoring.

### Non-Billing Phased Plan Of Attack
Phase A: Privacy and data lifecycle hardening
- Treat support, local drafts, planning local state, planning cloud sync, and exports as first-class data stores.
- Implemented baseline: support sensitive-content rejection, hashed support route logs, support lifecycle columns, clear-all controls, sign-out cleanup, planning import/export guardrails, and focused tests.
- Remaining: retention policy execution, deletion/redaction runbooks, support admin workflow, local autosave setting, and the final policy decision on planning teacher notes in cloud sync.

Phase B: Support and operations
- Implemented baseline: support status fields, server-side admin allowlist, minimal admin/support view, assignment, redaction, soft deletion, request IDs, hashed route logs, sanitized support notifications, retention tooling, and support PII runbook.
- Configure and test route alerts in staging/production.
- Remaining: deployed alert validation, scheduled retention automation, abuse dashboard, and incident runbooks for AI provider failures, planning sync conflicts, and account deletion.

Phase C: Planning sync reliability
- Introduce server-generated revisions and conditional writes.
- Make timestamps server-owned and preserve client edit timestamps separately.
- Add conflict audit rows and stronger tests for multi-device races, stale queue replay, duplicate queue flushes, and offline/online transitions.

Phase D: AI quality and safety
- Add prompt/model version fields to usage events.
- Create a golden evaluation suite and red-team cases for Swedish school documentation.
- Add post-generation suspicious-output checks and teacher-visible warnings.
- Add provider timeout/cancel handling and release smoke tests.

Phase E: Account lifecycle and security hardening
- Add email change, data export, account deletion, and session/security settings.
- Decide on account enumeration tradeoffs in registration.
- Tighten CSP in report-only mode, then move toward an enforced nonce/hash policy where feasible.
- Complete manual accessibility and auth-security sign-off.

Phase F: Product expansion only after reliability
- Expand curriculum coverage, OCR/handwritten-note ideas, and new templates after the data lifecycle, support, sync, and AI governance foundations are stable.

Non-billing Phase A/B implementation verification on April 26, 2026:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test -- lib/server/__tests__/operational-alerts.test.ts lib/support/__tests__/admin.test.ts app/api/support/route.test.ts`
- `node --check scripts/retention-support.mjs`
- `pnpm build`

Result:
- typecheck, lint, retention script syntax check, and production build passed
- Vitest passed with 167 tests. The package script forwarded the path filter as a literal `--`, so the command exercised the full suite rather than only the named files.

Verified on April 23, 2026:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Result:
- all four checks passed
- the test suite is currently at 134 passing tests

Live Supabase note:
- Supabase MCP access was available again on April 23, 2026, so I was able to refresh limited live project signals in this session.
- Live security advisors confirmed that leaked-password protection is still disabled. That remains a real limitation for a password-based auth product, but on this project it is currently a plan constraint because Supabase only exposes that feature on Pro and above.
- Live security advisors also flagged `public.support_requests` as RLS-enabled with no policies. In this repo that appears intentional because support requests are handled through the server-side admin client rather than direct client-side table access.

## Executive Summary
Skolskribenten now has a strong advanced-MVP codebase. The core teacher workflow is real, the GDPR-first architecture still holds, planning is no longer a placeholder, billing correctness is materially better than before, and the repository is healthy under typecheck, lint, test, and production build.

It is not yet production-ready.

The remaining gap is not "finish the app." The remaining gap is production discipline:
- no real observability or alerting layer is visible in the repo
- no release workflow beyond CI is visible in the repo
- critical live/manual sign-off items are still not completed
- the planning sync model is still best-effort rather than high-confidence versioned sync

Current recommendation:
- treat the product as pre-production or controlled-pilot ready
- do not call it production-ready until the non-billing Phase A-C items, the billing launch gates, and the older Phase 1/2 launch/operations gates below are complete

## Current Production Readiness Snapshot
| Area | Status | Notes |
| --- | --- | --- |
| Core app architecture | Strong | Clear product boundaries, working App Router structure, meaningful middleware and route coverage |
| Privacy and GDPR model | Partial | Drafting raw notes are still scrubbed client-side and generated output is not stored. Phase A now covers support rejection, local clear-all, and import/export guardrails, but planning cloud sync policy, retention execution, and admin deletion/redaction workflows remain open |
| Billing correctness | Partial | The local billing/entitlement design is now much stronger after the April 26 hardening, but live end-to-end Stripe verification is still missing |
| Testing and CI | Partial | Local quality checks are green, CI is healthy, and Dependabot now covers baseline dependency automation |
| Security posture | Partial | Good headers, server validation, and baseline support abuse controls exist, and the app now enforces a stronger non-Pro password baseline, but launch-grade auth hardening is still incomplete |
| Observability and incident response | Partial | Key public routes now expose request IDs and can forward sanitized error alerts to a webhook, but no full monitoring stack or validated incident workflow is visible in the repo |
| Release management | Weak | No deploy, smoke-test, rollback, or staging workflow is visible in the repo |
| Planning reliability | Partial | Useful for single-user recovery, not yet strong enough to market as dependable multi-device sync |
| Product truth in docs | Improving | `README.md`, `docs/audit.md`, `docs/billing-security.md`, and `docs/roadmap` now describe the current product more accurately; `docs/design` has been reduced to a historical archive pointer |

## What Is Working Well
- The core drafting privacy promise still maps cleanly to code. `/api/ai` only accepts scrubbed input in `app/api/ai/route.ts:21-28`, re-scrubs server-side in `app/api/ai/route.ts:294-297`, and blocks suspicious payloads in `app/api/ai/route.ts:297-304`.
- The AI route has real safety and entitlement logic rather than naive pass-through behavior. See `app/api/ai/route.ts:17-18`, `app/api/ai/route.ts:198-221`, and `app/api/ai/route.ts:318-396`.
- Security headers are already applied centrally in middleware through `lib/supabase/middleware.ts:9-27`.
- Billing is materially safer than before. The authoritative Stripe/customer/session/subscription/event/entitlement projection is documented in `docs/billing-security.md`, with the durable database layer in migrations `013` and `014`.
- The planning module is now a real product area, not dead scaffolding. The route, workspace, cloud sync, and AI-assisted planning are all live in `app/api/planning/checklist/route.ts:67-187`, `components/planning/PlanningWorkspace.tsx`, and `hooks/usePlanningChecklist.ts`.
- The public support flow now has baseline abuse controls. The form includes a honeypot in `components/shared/ContactForm.tsx:22-88`, while the server suppresses honeypot spam, duplicate submissions, and bursty repeat requests in `app/api/support/route.ts:39-121` with helpers in `lib/support/abuse-protection.ts:20-46`.
- Password auth no longer relies on the old bare 8-character minimum. Registration and password reset now require a 12-character password with at least one lowercase letter, one uppercase letter, and one digit through the shared policy in `lib/auth/password-policy.ts` and `app/(auth)/actions.ts`.
- Key public routes now share request IDs and structured route logging through `lib/server/request-context.ts:71-98`, and that context is applied across AI, support, checkout, portal, and Stripe webhook handlers.
- The ops layer now has a webhook-ready alert foundation. Sanitized route failures can be forwarded through `lib/server/operational-alerts.ts:1-175` when `OPS_ALERT_WEBHOOK_URL` is configured, without sending teacher-written content.
- The repository now has baseline dependency automation through `.github/dependabot.yml`.
- The repository still has a healthy local quality baseline. On April 23, 2026, `typecheck`, `lint`, `test`, and `build` all passed, and the suite remains at 134 passing tests.

## Current Findings
### 1. Production operations are still incomplete even though the monitoring foundation is now in place
Severity: High

Why it matters:
The app can fail in production without giving the team fast, structured visibility into what broke, who was affected, and what to do next. That is acceptable for MVP experimentation, but it is not enough for a production-ready teacher-facing service that depends on auth, billing, AI generation, and webhooks.

Evidence:
- `.github/workflows/ci.yml:1-38` is still the only GitHub Actions workflow in the repository, and it only runs install, typecheck, lint, tests, and build.
- `.github/dependabot.yml:1-11` now adds weekly dependency and GitHub Actions update automation, but that is still not release or incident automation.
- `package.json:11-29` includes no visible error-monitoring or observability dependency such as Sentry.
- Shared request correlation now exists in `lib/server/request-context.ts:71-98` and is wired through `app/api/ai/route.ts:277-411`, `app/api/support/route.ts:39-121`, `app/api/stripe/checkout/route.ts:15-127`, `app/api/stripe/portal/route.ts:10-62`, and `app/api/webhooks/stripe/route.ts:73-203`.
- `lib/server/operational-alerts.ts:1-175` can now send sanitized route-error alerts to `OPS_ALERT_WEBHOOK_URL`, but the repo still shows no validated alert-routing setup, deployment smoke-test workflow, or rollback automation.

Recommended fix direction:
- Configure `APP_ENV` and `OPS_ALERT_WEBHOOK_URL` in each deployed environment and validate that alerts reach a real team channel.
- Add structured monitoring for key client failures on top of the new server-route alert foundation.
- Add at least one post-deploy smoke-test path covering auth, AI generation, and billing.
- Add explicit rollback guidance for production releases.

### 2. Critical launch sign-off work is still incomplete
Severity: High

Why it matters:
You now have code that looks serious enough to launch, which makes missing live/manual sign-off more dangerous, not less. The remaining unknowns are concentrated in exactly the places that cause painful production incidents: account security, accessibility, and payments. The product is currently being treated as desktop-first rather than mobile-first.

Evidence:
- Local verification is strong, but it is still local: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` all passed on April 23, 2026.
- There is still no completed manual accessibility execution record in the repo for `/`, `/logga-in`, `/registrera`, `/skrivstation`, `/lektionsplanering`, `/installningar`, `/konto`, `/kontakt`, and `/vanliga-fragor`.
- There is still no recorded live Stripe test-mode verification with event IDs, webhook delivery results, and final `profiles` state.
- Live Supabase recheck on April 23, 2026 via MCP: leaked-password protection is still disabled. Because this project is not on a Pro plan, the practical question is whether the chosen non-Pro password baseline is strong enough and explicitly documented.

Recommended fix direction:
- Treat live auth hardening, accessibility execution for the primary desktop/browser flows, and Stripe end-to-end verification as launch gates.
- Record each manual verification pass directly in this audit with date, operator, environment, result, and follow-up.
- Keep the chosen non-Pro password baseline explicit in both product decisions and audit notes unless the project later moves to a plan that supports leaked-password protection.

### 3. The public support path has baseline abuse controls, but remains a privacy and operations gap
Severity: High

Why it matters:
The biggest spam/abuse blocker on `/api/support` is gone, which is good progress. The remaining problem is more important: the support form is a durable free-text storage path in a product whose trust model depends on avoiding teacher-written sensitive content. That is acceptable only if it is treated as an explicit exception with warnings, retention, deletion, and support operations.

Evidence:
- `app/kontakt/page.tsx:4-40` still exposes the support form publicly.
- `components/shared/ContactForm.tsx:22-88` now includes a hidden honeypot field.
- `app/api/support/route.ts` now suppresses honeypot spam, duplicate submissions, and repeated bursts from the same email, then rejects obvious sensitive content before storage.
- `lib/support/abuse-protection.ts:20-46` normalizes support emails and enforces the current duplicate and rate-limit heuristics.
- `support_requests.message` still stores accepted free text, but lifecycle fields, redaction timestamps, deletion timestamps, owner fields, request IDs, and a status timestamp trigger now exist.
- `/admin/support` and `docs/support-operations.md` provide a minimal triage and redaction workflow. There is still no visible CAPTCHA, IP-aware limiter, abuse dashboard, notification delivery, or automated retention job.

Recommended fix direction:
- Keep the current abuse protections as the baseline for pilot traffic.
- Keep sensitive-content warnings, server-side checks, redaction, and support-admin workflow under regression coverage.
- Add retention automation, notification delivery, and an abuse dashboard.
- If spam shows up in practice, add stronger abuse controls such as IP-aware throttling or a higher-friction challenge.

### 4. Planning sync is still honest for MVP, but not strong enough for a production-grade reliability promise
Severity: Medium

Why it matters:
The planning workspace is now useful, so teachers can reasonably assume that cloud sync is dependable. The current implementation is good enough for single-user recovery and light cross-device use, but it is still a best-effort merge model. That is a product-positioning risk if the app is described as production-ready without being precise about what the sync layer guarantees.

Evidence:
- `app/api/planning/checklist/route.ts:143-166` only flags a conflict when the server timestamp is newer than the client timestamp.
- `lib/planning/cloud-merge.ts:13-26` merges checklist status by "highest status wins."
- `lib/planning/cloud-merge.ts:29-41` merges note conflicts by concatenating server and client text.
- `app/api/planning/checklist/route.ts:156-163` returns a heuristic merged state rather than a versioned or replay-safe resolution.
- The current product contract is still closer to single-user cloud recovery than durable revisioned sync.

Recommended fix direction:
- Make a product decision: either keep planning sync explicitly best-effort, or invest in explicit revision/version semantics.
- If you keep the current model, tighten the in-product copy so the feature promise stays accurate.
- Do not market planning cloud sync as "dependable everywhere" until manual conflict tests are executed and the wording is validated.

### 5. The repository docs are better aligned after replacing the stale design prompt
Severity: Low

Why it matters:
The main contradiction problem is no longer the README or the old design prompt. The large stale prompt in `docs/design` has been replaced by a short historical note, and `docs/roadmap` now reflects the current phased plan. The remaining docs risk is keeping the privacy exceptions and operational plan current as code changes.

Evidence:
- `README.md` now reflects the live planning route, API surface, env-var expectations, and migration state.
- `docs/audit.md` is now the repo's best current operational source of truth.
- `docs/design` is now a short historical archive pointer instead of a stale build specification.
- `docs/roadmap` is now a concise current roadmap instead of two stale bullets.

Recommended fix direction:
- Keep `docs/audit.md` as the operational source of truth.
- Keep `docs/roadmap` short and current.
- Delete `docs/design` entirely later if no one needs the historical placeholder.

## Status Of Previous Audit Items
### Fixed Since The Previous Audit
- Planning generation no longer rides on the generic `custom` path. The dedicated planning contract now exists in `lib/ai/provider.ts` and `lib/ai/prompts.ts`.
- One-time billing fulfillment no longer grants access from `checkout.session.completed`. The corrected flow is in `app/api/stripe/checkout/route.ts:84-109` and `app/api/webhooks/stripe/route.ts:115-125`.
- Stripe route error handling is more consistent than before because checkout and portal now share `lib/stripe/route-error.ts`.
- The planning feature is no longer a route shell. It now includes checklist state, cloud sync, and direct generation.
- The public support flow now includes baseline abuse protection through a honeypot, duplicate suppression, and per-email burst limiting in `components/shared/ContactForm.tsx`, `app/api/support/route.ts`, and `lib/support/abuse-protection.ts`.
- Password auth now enforces a stronger app-side baseline through `lib/auth/password-policy.ts` and `app/(auth)/actions.ts`.
- Key public routes now share request IDs and structured route logging through `lib/server/request-context.ts`.
- Key public route errors can now be forwarded to a sanitized operational webhook through `lib/server/operational-alerts.ts`.
- `README.md` now reflects the current routes, planning surface, env vars, and migration state.
- Dependabot now provides baseline dependency automation through `.github/dependabot.yml`.

### Still Open
- The live auth posture is now partially reverified, but the project still relies on a non-Pro password-security baseline rather than leaked-password protection.
- Accessibility execution for the primary desktop/browser flows is still pending real manual verification.
- Live Stripe test-mode verification is still pending.
- The new webhook-ready alert path still needs to be connected to a real incident channel and validated in a live environment.
- Planning sync semantics are still intentionally shallow for multi-device confidence.
- Support intake, local planning storage, and planning exports now have baseline Phase A privacy controls; support retention/admin workflows and planning cloud sync policy still need completion.
- `lib/stripe/server.ts:3-10` still hardcodes and force-casts the Stripe API version.
- `lib/billing/entitlements.ts:13-74` still leaves the meaning of `cancelled` somewhat implicit.
- Browser persistence now has one global clear-all control for drafts, planning state, sync queues, and onboarding state; a user-level autosave setting is still open.

### Partially Fixed
- Planning reliability is better than before, but still best-effort rather than revisioned.
- Billing correctness is better than before, but it still lacks live end-to-end proof in a real test environment.
- Support abuse posture is better than before, but it is still intentionally lightweight rather than operations-grade.
- Support privacy posture is better after server-side sensitive-content rejection, lifecycle fields, hashed route logs, admin triage, redaction, soft deletion, and a support runbook. Retention automation and live operations validation are still missing.
- Operational visibility is better than before because key public routes now share request IDs, structured logs, and a sanitized webhook-ready alert path, but the live monitoring/incident loop is still not proven.
- Documentation alignment is much better because `README.md`, `docs/audit.md`, `docs/billing-security.md`, and `docs/roadmap` now point in the same direction, and `docs/design` has been reduced to an archive pointer.

### Regressed
- No clear regressions were confirmed relative to the prior audit baseline.

## Important Refactors
- Split `hooks/usePlanningChecklist.ts` into smaller units. It still mixes storage, queue state, replay, fetching, conflicts, and UI-facing state.
- Split the planning UI into smaller presentation layers. The workspace and onboarding surfaces still carry a lot of responsibility.
- Extend the shared server-surface pattern beyond the current public routes so validation, rate limiting, structured errors, and request IDs stay consistent everywhere.
- Route the new shared request-context logging into a real monitoring sink so AI, support, and Stripe failures are not only visible in server logs.

## Dead Code And Cleanup Candidates
- `docs/design` is now only a historical archive pointer. It can be deleted later if no contributor needs the placeholder.
- No high-confidence dead runtime code stood out in the current pass. The main cleanup signal is operational drift and documentation drift, not obvious unused production code.

## Should-Have Functionality Before Production
- Real error monitoring and alerting for auth, AI, support, and Stripe webhook failures.
- Complete privacy/data-lifecycle controls for support messages, local browser storage, planning cloud sync, and planning exports. Phase A now covers baseline controls, but not the full retention/admin policy.
- Support triage workflow with retention, deletion, and redaction handling. A minimal workflow now exists; retention automation still needs confirmation and implementation.
- AI prompt/model versioning plus a small evaluation suite for sensitive-content and hallucination regressions.
- One completed accessibility pass for the primary desktop/browser flows recorded in this audit.
- One completed live Stripe test-mode verification recorded in this audit.
- Re-verified live account-security posture, including the accepted non-Pro password-security baseline if the project stays below Supabase Pro.
- A release checklist with smoke tests and rollback steps.
- A deliberate product decision on planning sync guarantees.

## Nice-To-Have Later
- Broader curriculum coverage across more subjects and more than one area per subject.
- A user-controlled privacy toggle for local draft and planning persistence.
- Cleaner in-product explanations for planning conflict choices.
- A more explicit surfaced meaning for the `cancelled` subscription state if it remains in the data model.
- Light analytics for product learning once the operational basics are in place.

## UI/UX Audit
- The drafting flow is polished enough to support real users. The workflow feels intentional rather than improvised.
- The account page is clear, and the billing copy is notably honest. That is a trust strength worth keeping.
- The planning workspace is now useful, but the reliability promise still needs careful wording because the sync model is heuristic rather than versioned.
- Accessibility basics exist, including the skip link, `aria-live` usage, and security-minded middleware, but the absence of a completed manual pass still matters.
- One rough edge remains in the planning onboarding surface: `components/planning/PlanningOnboardingPanel.tsx:22-32` still relies on `window.alert` for copy confirmation and failure messaging. That is not a production blocker, but it does feel less polished than the rest of the product.
- The biggest UX trust problem is no longer inside the app. It is the remaining gap between polished in-app behavior and incomplete live/manual sign-off.

## Phased Implementation Plan
### Phase 1: Production Gate
Goal:
Close the launch blockers that would make a real production rollout irresponsible.

Concrete tasks:
- Re-verify live Supabase auth security settings and keep the chosen non-Pro password baseline explicit unless the project later moves to Supabase Pro.
- Execute and record the accessibility pass for the core public and dashboard routes in the primary desktop/browser experience.
- Run and record live Stripe test-mode verification for both the monthly and one-time flows.
- Record the results directly in this audit so the launch-signoff evidence lives in one place.

Expected impact:
- Removes the most immediate production risk across account security, payments, and public input surfaces.
- Gives you an actual launch sign-off record instead of relying on local confidence.

Dependencies:
- Live Supabase access
- Live or test Stripe access
- Manual browser and screen-reader execution time

### Phase 2: Operations And Release Maturity
Goal:
Make failures visible, actionable, and recoverable.

Concrete tasks:
- Configure `APP_ENV` and `OPS_ALERT_WEBHOOK_URL` in each environment and validate sanitized alert delivery from the shared route layer.
- Add structured production monitoring for key client errors on top of the new server-route alert foundation.
- Add a deployment checklist, post-deploy smoke tests, and rollback notes.
- Build on the new Dependabot baseline with security scanning or additional scheduled checks.

Expected impact:
- Faster incident detection
- Lower mean time to diagnose failures
- Safer releases

Dependencies:
- Tooling decision for monitoring
- Decision on where release runbooks should live

## Release And Smoke Checklist
Pre-release baseline:
- Confirm `APP_ENV` is set correctly for the target environment.
- Confirm `OPS_ALERT_WEBHOOK_URL` is configured for staging or production and points to a real incident channel.
- Make sure CI is green and check whether any open Dependabot updates need to be handled before release.

Post-deploy smoke pass:
- Load `/`, `/logga-in`, `/registrera`, `/kontakt`, and `/vanliga-fragor`.
- Confirm `/skrivstation`, `/lektionsplanering`, `/installningar`, and `/konto` still load for an authenticated teacher account.
- Verify `/api/support` still returns an `X-Request-Id` header on a controlled validation failure.
- Run one authenticated AI generation, one planning sync, and one billing portal open.
- In test mode, verify both Stripe purchase paths and confirm the final `profiles` result plus webhook handling.

Rollback baseline:
- Revert the last deploy or re-promote the previous healthy release.
- Repeat the short smoke pass on the restored version.
- Use the request ID from the failed release path to trace the error and confirm whether an operational alert was emitted.

### Phase 3: Product Reliability Hardening
Goal:
Resolve the remaining places where product promise and implementation guarantees are still slightly out of alignment.

Concrete tasks:
- Decide whether planning sync remains best-effort or moves to explicit revision semantics.
- Execute manual planning conflict scenarios and capture results in this audit.
- Resolve the `cancelled` subscription-state meaning more explicitly.
- Remove the Stripe API-version force-cast in `lib/stripe/server.ts`.
- Decide whether local draft and planning persistence should become user settings.

Expected impact:
- More honest product messaging
- Fewer ambiguous account and sync behaviors
- Lower long-term maintenance risk

Dependencies:
- Product decision on planning scope
- Small implementation pass across billing and settings

### Phase 4: Production Truth And Scale Preparation
Goal:
Align the repo, docs, and support posture with the product you are actually operating.

Concrete tasks:
- Decide whether to delete the now-minimal `docs/design` archive pointer.
- Add a minimal support-and-incident operating note so future contributors understand the live service expectations.
- Keep `docs/roadmap` aligned with this audit as phases move from planned to implemented.
- Expand curriculum coverage only after the reliability baseline is locked in.

Expected impact:
- Less onboarding friction
- Fewer stale assumptions
- Better readiness for broader growth after launch

Dependencies:
- Phase 1 and Phase 2 should be largely complete first so the docs do not immediately go stale again

## Verification Gaps
- I refreshed a limited slice of live Supabase project state on April 23, 2026 through MCP, but I did not validate every hosted auth setting beyond the surfaced advisor results.
- I did not run a live Stripe checkout in this session.
- I did not execute manual browser or screen-reader testing in this session.
- I did not validate any deployed staging or production environment because no deploy workflow or live environment controls were available in-session.

## Final Recommendation
Skolskribenten is close to being launchable, but it is still better described as pre-production than production-ready.

The good news is that the path ahead is clear:
1. finish the privacy/data-lifecycle work in non-billing Phase A
2. make support and operations real through Phase B and the older Phase 2
3. move planning sync from best-effort to revisioned reliability through Phase C
4. finish the launch gates in the older Phase 1 and the billing launch gates in `docs/billing-security.md`

If those items are completed cleanly, I would be comfortable re-auditing for a production-ready recommendation. Right now, I would recommend a controlled pilot or limited founder-led onboarding, not a broader production claim.
