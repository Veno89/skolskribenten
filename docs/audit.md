# Audit
This audit reviewed the required product and architecture sources (`README.md`, `docs/design`, `docs/roadmap`, `package.json`, `tsconfig.json`, `next.config.mjs`, `middleware.ts`), traced the main flows across `app/`, `components/`, `lib/`, `hooks/`, `types/`, and `supabase/migrations/`, and then evolved into an implementation-backed status document. On April 19, 2026, the original Phase 1 safety work was implemented in code, the matching Supabase migration `supabase/migrations/008_phase1_safety_hardening.sql` was applied to the connected project via Supabase MCP, and the planned Phase 2 structural refactors were started and completed in the app code. Local verification was rerun after the changes with `pnpm.cmd typecheck`, `pnpm.cmd test`, `pnpm.cmd lint`, and `pnpm.cmd build`; all passed.

## Executive Summary
The codebase is in materially better shape than it was at the start of the audit. The original trust-boundary blockers are now addressed: profile writes are locked down at the database layer, local drafts are scoped and short-lived, `/api/ai` has server-side PII guardrails plus transactional quota enforcement, and billing now blocks duplicate purchases while exposing a real Stripe customer portal. Phase 2 also reduced maintenance risk by centralizing entitlement logic, introducing shared dashboard profile loading, and splitting `DraftingStation` into smaller hooks and components.

Product readiness has moved from "not ready for broader testing" to "ready for controlled broader teacher testing." The remaining gaps are mostly product-completeness and verification issues rather than hard safety flaws: route-level regression coverage is still thin, support still depends on `mailto:`, and `lektionsplanering` is still a preview surface rather than a usable module.

## Implementation Status Update
- Phase 1 completed on April 19, 2026:
  - RLS hardening and atomic quota/rate-limit RPCs in `supabase/migrations/008_phase1_safety_hardening.sql`.
  - Server-side PII guard and DB-backed generation reservation flow in `app/api/ai/route.ts` and `lib/gdpr/server-guard.ts`.
  - Safer per-user draft persistence and logout cleanup in `components/drafting/DraftingStation.tsx`, `components/auth/SignOutButton.tsx`, and `lib/drafting/draft-storage.ts`.
  - Duplicate-checkout protection and Stripe billing portal in `app/api/stripe/checkout/route.ts`, `app/api/stripe/portal/route.ts`, and `app/(dashboard)/konto/KontoClient.tsx`.
  - Signup-time legal links in `app/(auth)/registrera/page.tsx`.
- Phase 2 completed in code on April 19, 2026:
  - Shared entitlement/plan rules in `lib/billing/entitlements.ts`.
  - Shared dashboard auth/profile loading in `lib/dashboard/load-dashboard-profile.ts`.
  - Shared missing-profile and dashboard action UI in `components/dashboard/MissingProfileState.tsx` and `components/dashboard/DashboardPageActions.tsx`.
  - `DraftingStation` split across `components/drafting/DraftingHeader.tsx`, `hooks/useDraftPersistence.ts`, and `hooks/useDocumentGeneration.ts`.
  - Provider abstraction simplified in `lib/ai/provider.ts`, and the dead `components/ui/tooltip.tsx` file was removed.
- Phase 3 is now the next active phase:
  - Support/contact reliability.
  - Better handling of `lektionsplanering` as an unfinished module.
  - Additional UX trust/polish and route-level regression coverage.

## What Is Working Well
- The repo structure is still easy to reason about: auth, dashboard, marketing, API, and shared UI concerns are separated cleanly under `app/` and `components/`.
- The prompt layer remains centralized and product-aware in `lib/ai/prompts.ts`, with user preferences validated in `lib/validations/user-settings.ts`.
- The GDPR layer is now stronger end to end: the browser scrubber remains isolated in `lib/gdpr/scrubber.ts`, and the server now adds its own best-effort guard in `lib/gdpr/server-guard.ts`.
- Billing and entitlement logic now have a single source of truth in `lib/billing/entitlements.ts`, which removes repeated plan math from `app/api/ai/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/portal/route.ts`, `components/drafting/UsageCounter.tsx`, and `app/(dashboard)/konto/KontoClient.tsx`.
- Dashboard pages now share a cleaner loading path through `lib/dashboard/load-dashboard-profile.ts`, with a consistent fallback in `components/dashboard/MissingProfileState.tsx`.
- `DraftingStation` is meaningfully easier to maintain after the split into hooks/components, while preserving the existing drafting UX in `components/drafting/DraftingStation.tsx`.
- Local verification remains healthy after the refactor: typecheck, tests, lint, and production build all pass.

## Critical Findings
### 1. Route-level regressions still depend mostly on manual testing
Severity: High

Why it matters: The riskiest flows now live in server routes and server-only helpers: `/api/ai`, `/api/stripe/checkout`, `/api/stripe/portal`, Stripe webhooks, and dashboard profile loading. Those flows have more moving parts after Phase 1 and Phase 2, but automated coverage is still concentrated in pure utility modules.

Evidence:
- Tests exist for pure logic in `lib/ai/__tests__/prompts.test.ts`, `lib/gdpr/__tests__/scrubber.test.ts`, `lib/gdpr/__tests__/server-guard.test.ts`, `lib/drafting/__tests__/draft-storage.test.ts`, `lib/billing/__tests__/entitlements.test.ts`, and `lib/validations/__tests__/user-settings.test.ts`.
- There are no route-level tests covering `app/api/ai/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/portal/route.ts`, `app/api/webhooks/stripe/route.ts`, or `middleware.ts`.

Recommended fix direction: Add focused route/integration tests around auth failures, duplicate checkout prevention, portal access, quota exhaustion, server-side PII rejection, and Stripe webhook entitlement updates before wider paid usage.

### 2. Support still relies on the user's local mail client
Severity: Medium

Why it matters: On school-managed devices, `mailto:` often fails or opens the wrong app. That creates a support dead-end exactly where trust and responsiveness matter most during testing.

Evidence:
- `components/shared/ContactForm.tsx` still builds a `mailto:` URL and redirects the browser to it.
- `app/kontakt/page.tsx` positions the contact form as the main support path, even though the underlying delivery model depends on the client device's mail setup.

Recommended fix direction: Replace `mailto:` with a real server-side submission path, or at minimum add a reliable copy-to-clipboard fallback plus explicit support-email instructions that do not depend on a mail client opening successfully.

### 3. `lektionsplanering` is still a top-level workspace destination for a non-usable module
Severity: Medium

Why it matters: The page is framed honestly, but it still occupies first-class navigation real estate in the main drafting workspace. That can create expectation debt and distract from the mature core flow during early testing.

Evidence:
- `components/drafting/DraftingHeader.tsx` links to `/lektionsplanering` alongside the active core routes.
- `app/(dashboard)/lektionsplanering/page.tsx` remains a preview/coming-soon page rather than a working tool.

Recommended fix direction: Recast it as a waitlist/preview CTA or move it behind a softer "Kommer snart" affordance until there is a usable first version.

## Important Refactors
- Add a lightweight route/integration test harness for the app router server surface. The structural refactors are in place; the next leverage point is protecting them with tests.
- Expand the shared dashboard shell only if more dashboard modules are added. `load-dashboard-profile.ts`, `DashboardPageActions.tsx`, and `MissingProfileState.tsx` are a good base, but a full shell abstraction would be premature until another substantial dashboard feature lands.
- Consider centralizing support/legal/marketing copy in one module once the current product messaging stabilizes. Right now the copy is consistent enough, but there is still duplication across landing, legal, support, and account surfaces.
- Keep the new entitlement module as the only source of truth. Any future pricing, quota, or plan-state changes should go through `lib/billing/entitlements.ts` first rather than being reintroduced ad hoc in routes or components.

## Dead Code And Cleanup Candidates
- `@radix-ui/react-tooltip` in `package.json` / `pnpm-lock.yaml`
Confidence: High
Evidence: The dead wrapper component `components/ui/tooltip.tsx` was removed, and no remaining app code references tooltip primitives.

- `docs/design`
Confidence: High as stale documentation, low as removable file
Evidence: The document still contains valuable product intent, but it no longer matches the live code 1:1 and still describes behaviors that have since been refactored or tightened.

## Should-Have Functionality
- A support path that works without `mailto:`. This is the clearest remaining MVP-level gap because it affects trust and supportability during testing.
- A safer presentation for `lektionsplanering`, either as an explicit preview/waitlist or a less-prominent roadmap item.
- Route-level regression coverage for auth, AI generation, billing, and webhooks before opening paid usage more broadly.
- An explicit privacy preference for local draft persistence if the product wants to keep local autosave long term instead of making it a fixed behavior.

## Nice-To-Have Later
- Export helpers for downstream school systems such as Unikum-adjacent or DF Respons-style destinations.
- Saved class or extra-name lists per teacher so the GDPR name workflow gets faster over time.
- OCR / handwritten-note capture once privacy, support, and billing flows are fully stable.
- PWA or offline improvements after the local-device privacy model is finalized.
- Admin/reporting tooling after telemetry and route-level verification become more mature.

## UI/UX Audit
Navigation: The dashboard is more coherent after the shared action/navigation cleanup, and the account page is stronger now that it can manage an existing subscription. The one navigation item that still feels too "real" for its current state is `lektionsplanering`, because it lives next to mature routes while still being only a preview.

Information hierarchy: The landing page, settings flow, legal pages, and drafting station remain the strongest surfaces. The account page is now much more honest and complete because it reflects active plan state and exposes the Stripe portal instead of always pushing another purchase.

Clarity: The Swedish-language copy is still one of the product's strongest qualities. The biggest remaining clarity gap is support: the contact page sounds reliable, but the delivery mechanism still depends on the user's mail client.

Workflow friction: The drafting flow is now easier to maintain without losing its strengths: template-specific placeholders, explicit name handling, temporary draft recovery, streaming output, and quick copy-forward behavior. Remaining friction is mostly around unfinished adjacent flows rather than the main drafting path.

Visual consistency: The app still feels cohesive. The new dashboard primitives did not introduce visual drift, which is a good sign that the current design language is stable enough for continued iteration.

Accessibility: Template selection improved earlier with `aria-pressed` and grouping semantics in `components/drafting/TemplatePicker.tsx`. I still did not run a full manual screen-reader or axe pass, so accessibility confidence is improved but not complete.

Mobile: The main layouts still adapt reasonably through stacked/flex layouts. The drafting header is cleaner structurally after extraction into `components/drafting/DraftingHeader.tsx`, but it should still be manually tested on narrow widths because it combines navigation, usage state, and the GDPR badge in one area.

Trust and polish: Trust is substantially better than in the original audit because the most serious privacy and billing contradictions have been removed. The remaining trust gaps are smaller and more operational: dependable support, clearer staging of unfinished modules, and more automated protection around the server routes.

## Phased Implementation Plan
### Phase 1: Critical safety, correctness, and trust-boundary fixes
Status: Completed on April 19, 2026.

Goal: Close the biggest privacy, quota, and billing risks before inviting broader testers.

Concrete tasks:
- Lock down `profiles` updates so browser-side users can only change allowed profile fields.
- Remove the unsafe global-draft behavior in favor of per-user scoped, expiring local persistence with logout cleanup.
- Add server-side PII detection/guardrails in `/api/ai` and stop treating client scrubber stats as authoritative.
- Replace non-atomic usage/rate-limit updates with transactional RPC-based enforcement.
- Prevent duplicate paid checkouts and add a basic manage/cancel flow for subscriptions.

Expected impact: Completed. The app now has a materially stronger privacy and billing boundary, and the database/runtime behavior matches the product promise much more closely.

Dependencies: Completed. This required code changes plus the live Supabase migration `supabase/migrations/008_phase1_safety_hardening.sql`, which has been applied.

### Phase 2: High-value structural refactors
Status: Completed in code on April 19, 2026.

Goal: Make the core flows easier to maintain without changing the product surface too much.

Concrete tasks:
- Split `DraftingStation` into hooks/components for autosave, generation, and header/layout concerns.
- Centralize plan limits, labels, and entitlement logic in one billing module.
- Introduce a shared dashboard profile loader and shared dashboard fallback/action primitives.
- Simplify the unused provider abstraction and remove obvious dead UI code.

Expected impact: Completed. Regression risk is lower, duplicated plan logic is gone, and future dashboard work now has cleaner primitives to build on.

Dependencies: Completed. This phase depended on the Phase 1 billing/quota model being stable first.

### Phase 3: UX polish and MVP completeness
Status: Next active phase.

Goal: Make the current surface feel dependable for broader teacher testing and early paid adoption.

Concrete tasks:
- Replace `mailto:`-only support with a more reliable contact path.
- Rework the `lektionsplanering` entry so it behaves like an intentional preview rather than a first-class working module.
- Add route-level tests for `/api/ai`, Stripe checkout/portal/webhooks, and middleware.
- Manually test drafting, billing, and dashboard navigation on mobile widths and with an accessibility pass.
- Decide whether local draft persistence should become a user-controlled privacy preference.

Expected impact: Better tester confidence, fewer support dead-ends, and much lower regression risk in the server flows that now matter most.

Dependencies: Phase 1 and Phase 2 are now complete, so Phase 3 can proceed immediately.

### Phase 4: Deferred enhancements
Status: Deferred.

Goal: Expand product value after the foundations and support paths are reliable.

Concrete tasks:
- Add export helpers for downstream school systems.
- Add saved name/class context for faster scrubbing.
- Explore OCR/handwritten note import and later PWA/mobile improvements.
- Add richer analytics/admin tooling only after telemetry and support flows are trustworthy.

Expected impact: Better retention and broader scope without weakening the core documentation workflow.

Dependencies: Stable billing, support, privacy, and route-level test coverage.

## Verification Gaps
- I did not run end-to-end live Stripe purchases, portal actions, or webhook deliveries against external services in this pass.
- I did not manually verify live Anthropic generations through the deployed environment after the latest refactors.
- I did not run a full accessibility audit with a screen reader or axe.
- I did not manually validate the current UI on mobile breakpoints in a browser.
- Local verification completed successfully on April 19, 2026:
  - `pnpm.cmd typecheck`
  - `pnpm.cmd test`
  - `pnpm.cmd lint`
  - `pnpm.cmd build`
- The Supabase database migration `supabase/migrations/008_phase1_safety_hardening.sql` was applied successfully to the connected project via Supabase MCP on April 19, 2026.

## Final Recommendation
Yes, the codebase is now ready for controlled broader human testing.

I would still keep the rollout deliberate: founder-led or invited pilot usage rather than an open paid launch. The original critical safety blockers are no longer the main concern. The next work should focus on support reliability, route-level regression coverage, and how unfinished surfaces like `lektionsplanering` are presented so early testers only encounter flows the product can confidently support.
