# Audit
This is a production-readiness assessment of the live Skolskribenten repository on April 23, 2026. I reviewed the current docs and config, traced the main product flows across marketing, auth, drafting, planning, billing, support, and middleware, and reran the local quality checks.

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
- do not call it production-ready until Phase 1 and Phase 2 below are complete

## Current Production Readiness Snapshot
| Area | Status | Notes |
| --- | --- | --- |
| Core app architecture | Strong | Clear product boundaries, working App Router structure, meaningful middleware and route coverage |
| Privacy and GDPR model | Strong | Raw notes are still scrubbed client-side before AI requests and usage storage remains metadata-oriented |
| Billing correctness | Partial | The one-time Stripe fulfillment fix is in place, but live end-to-end verification is still missing |
| Testing and CI | Partial | Local quality checks are green, CI is healthy, and Dependabot now covers baseline dependency automation |
| Security posture | Partial | Good headers, server validation, and baseline support abuse controls exist, and the app now enforces a stronger non-Pro password baseline, but launch-grade auth hardening is still incomplete |
| Observability and incident response | Partial | Key public routes now expose request IDs and can forward sanitized error alerts to a webhook, but no full monitoring stack or validated incident workflow is visible in the repo |
| Release management | Weak | No deploy, smoke-test, rollback, or staging workflow is visible in the repo |
| Planning reliability | Partial | Useful for single-user recovery, not yet strong enough to market as dependable multi-device sync |
| Product truth in docs | Partial | `README.md` and `docs/audit.md` are current enough to use, and `docs/design` is now clearly historical, but the repo still lacks a smaller polished current-state reference beyond the audit |

## What Is Working Well
- The core privacy promise still maps cleanly to code. `/api/ai` only accepts scrubbed input in `app/api/ai/route.ts:21-28`, re-scrubs server-side in `app/api/ai/route.ts:294-297`, and blocks suspicious payloads in `app/api/ai/route.ts:297-304`.
- The AI route has real safety and entitlement logic rather than naive pass-through behavior. See `app/api/ai/route.ts:17-18`, `app/api/ai/route.ts:198-221`, and `app/api/ai/route.ts:318-396`.
- Security headers are already applied centrally in middleware through `lib/supabase/middleware.ts:9-27`.
- Billing is materially safer than before. Checkout now keeps recurring purchases card-only and mirrors one-time metadata onto the PaymentIntent in `app/api/stripe/checkout/route.ts:84-109`, while the webhook grants one-time access only from `payment_intent.succeeded` in `app/api/webhooks/stripe/route.ts:115-125`.
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

### 3. The public support path is materially safer now, but still intentionally lightweight
Severity: Medium

Why it matters:
The biggest launch blocker on `/api/support` is gone, which is good progress. But the current protections are still a pragmatic baseline rather than a full abuse and support-operations posture. That is acceptable for a controlled pilot, but it is not the same thing as a mature production contact pipeline.

Evidence:
- `app/kontakt/page.tsx:4-40` still exposes the support form publicly.
- `components/shared/ContactForm.tsx:22-88` now includes a hidden honeypot field.
- `app/api/support/route.ts:49-98` silently suppresses honeypot spam, duplicate submissions, and repeated bursts from the same email.
- `lib/support/abuse-protection.ts:20-46` normalizes support emails and enforces the current duplicate and rate-limit heuristics.
- There is still no visible CAPTCHA, IP-aware limiter, abuse dashboard, or support triage runbook in the repo.

Recommended fix direction:
- Keep the current protections as the baseline for pilot traffic.
- If spam shows up in practice, add stronger abuse controls such as IP-aware throttling or a higher-friction challenge.
- Document a lightweight support-triage and incident-handling note once the operational layer is added.

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

### 5. The repository docs are much better aligned, but the long-form design spec is still legacy material
Severity: Low

Why it matters:
The main contradiction problem is no longer the README. The remaining issue is mostly polish and maintainability: `docs/design` is now correctly framed as historical, but it is still a large legacy artifact with encoding noise and older implementation detail. That is no longer a launch blocker, but it is still worth cleaning up if the repo is being prepared for broader collaboration.

Evidence:
- `README.md` now reflects the live planning route, API surface, env-var expectations, and migration state.
- `docs/audit.md` is now the repo's best current operational source of truth.
- `docs/design:8-17` now explicitly frames itself as historical build-spec material and points readers to `docs/audit.md`, the codebase, and `docs/roadmap`.
- The remaining roughness is in the file itself: mojibake remains in the title and instructional copy, and the rest of the document is still a large archived spec rather than a small current-state note.

Recommended fix direction:
- Keep `docs/audit.md` as the operational source of truth.
- Avoid adding new operational guidance to `docs/design` unless it is deliberately maintained again.
- If you want a cleaner collaborator experience later, either archive the file more aggressively or replace it with a smaller historical note.

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
- `lib/stripe/server.ts:3-10` still hardcodes and force-casts the Stripe API version.
- `lib/billing/entitlements.ts:13-74` still leaves the meaning of `cancelled` somewhat implicit.
- `hooks/useDraftPersistence.ts:104-208` still stores drafts locally with no user-controlled privacy setting.

### Partially Fixed
- Planning reliability is better than before, but still best-effort rather than revisioned.
- Billing correctness is better than before, but it still lacks live end-to-end proof in a real test environment.
- Support abuse posture is better than before, but it is still intentionally lightweight rather than operations-grade.
- Operational visibility is better than before because key public routes now share request IDs, structured logs, and a sanitized webhook-ready alert path, but the live monitoring/incident loop is still not proven.
- Documentation alignment is much better because `README.md`, `docs/audit.md`, and the `docs/design` banner now point in the same direction, but `docs/design` still carries legacy formatting debt.

### Regressed
- No clear regressions were confirmed relative to the prior audit baseline.

## Important Refactors
- Split `hooks/usePlanningChecklist.ts` into smaller units. It still mixes storage, queue state, replay, fetching, conflicts, and UI-facing state.
- Split the planning UI into smaller presentation layers. The workspace and onboarding surfaces still carry a lot of responsibility.
- Extend the shared server-surface pattern beyond the current public routes so validation, rate limiting, structured errors, and request IDs stay consistent everywhere.
- Route the new shared request-context logging into a real monitoring sink so AI, support, and Stripe failures are not only visible in server logs.

## Dead Code And Cleanup Candidates
- `docs/design` is still a cleanup candidate because it is intentionally archived and still carries legacy formatting and encoding artifacts.
- No high-confidence dead runtime code stood out in the current pass. The main cleanup signal is operational drift and documentation drift, not obvious unused production code.

## Should-Have Functionality Before Production
- Real error monitoring and alerting for auth, AI, support, and Stripe webhook failures.
- One completed accessibility pass for the primary desktop/browser flows recorded in this audit.
- One completed live Stripe test-mode verification recorded in this audit.
- Re-verified live account-security posture, including the accepted non-Pro password-security baseline if the project stays below Supabase Pro.
- A release checklist with smoke tests and rollback steps.
- A deliberate product decision on planning sync guarantees.

## Nice-To-Have Later
- Broader curriculum coverage across more subjects and more than one area per subject.
- A user-controlled privacy toggle for local draft persistence.
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
- Decide whether local draft persistence should become a user setting.

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
- Decide whether to keep `docs/design` as archived background material or replace it with a smaller historical note.
- Add a minimal support-and-incident operating note so future contributors understand the live service expectations.
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
1. finish the launch gates in Phase 1
2. add the missing operations layer in Phase 2
3. resolve the remaining product-reliability decisions in Phase 3

If Phase 1 and Phase 2 are completed cleanly, I would be comfortable re-auditing for a production-ready recommendation. Right now, I would recommend a controlled pilot or limited founder-led onboarding, not a broader production claim.
