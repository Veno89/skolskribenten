# Skolskribenten — Comprehensive Code Audit

Performed: April 27, 2026.
Scope: Full codebase analysis covering code health, UI/UX, onboarding, security, payment, GDPR, AI pipeline, planning sync, support operations, testing, error handling, and developer experience.

---

## Executive Summary

Skolskribenten is an advanced MVP with **strong billing security, thoughtful GDPR design, and solid test coverage for its backend logic**. The docs are honest about what's missing.

However, there are real issues worth fixing before a broader launch — spanning from a **695-line God Component** and an **875-line God Hook** to **missing accessibility**, **no loading/error boundaries**, **UTF-8 corruption in metadata**, and an **incomplete onboarding flow**. The codebase is at the stage where further feature work should pause in favour of a structural quality pass.

---

## Audit Domains

### 1. Architecture & Code Health

| Finding | Severity | Location |
|---|---|---|
| **God Component: `PlanningWorkspace.tsx` (695 lines)** — mixes selectors, dropdowns, conflict resolution UI, queue management, import/export, AI generation, stat cards, and inline sub-components (`InlineMessage`, `ConflictCard`, `QueueStatusBadge`, `StatCard`). | 🔴 High | `components/planning/PlanningWorkspace.tsx` |
| **God Hook: `usePlanningChecklist.ts` (875 lines)** — handles local state, localStorage hydration, cloud sync, conflict resolution, queue management, and debounced posting in a single hook. Contains inline `async` functions, deeply nested conditionals, and 10+ `useEffect` blocks with complex dependency arrays. | 🔴 High | `hooks/usePlanningChecklist.ts` |
| **AI route handler (538 lines)** — `app/api/ai/route.ts` combines auth, validation, scrubbing, quota check, RPC fallback, Anthropic streaming, output guard, usage recording, and response building. Many responsibilities for a single file. | 🟡 Medium | `app/api/ai/route.ts` |
| **No React Error Boundaries** — a runtime error in any client component will crash the entire page with no recovery UI. | 🟡 Medium | App-wide |
| **No `loading.tsx` or `error.tsx` Next.js convention files** — missing for all dashboard route segments, meaning no loading skeletons or graceful error fallback during server-side rendering. | 🟡 Medium | `app/(dashboard)/` |
| **Inline sub-components** — `StatCard`, `QueueStatusBadge`, `InlineMessage`, `ConflictCard` are defined inside `PlanningWorkspace.tsx` rather than being proper shared components. | 🟢 Low | `components/planning/PlanningWorkspace.tsx` |
| **Duplicated `getValue(formData, key)` helper** — defined identically in both `app/(auth)/actions.ts` and `app/(dashboard)/installningar/actions.ts`. | 🟢 Low | Both action files |

---

### 2. UI/UX & Design System

| Finding | Severity | Location |
|---|---|---|
| **DashboardNav overflows on mobile** — the nav renders 4+ pill buttons in a horizontal row with `overflow-x-auto` and no mobile hamburger/drawer. Admin users get 8 buttons that will force horizontal scrolling. | 🔴 High | `components/dashboard/DashboardNav.tsx` |
| **No font loading strategy** — `--font-sans` is `"Aptos", "Segoe UI", "Helvetica Neue", sans-serif` and `--font-display` is `"Iowan Old Style", "Palatino Linotype", serif`. These are not loaded via Google Fonts or `next/font`, so FOUT (Flash of Unstyled Text) is likely, and most non-Windows users will get browser-default serif/sans. | 🟡 Medium | `app/globals.css` |
| **Hardcoded `text-[11px]`** — used 6+ times in `PlanningWorkspace.tsx` for sync queue details. This is below readable minimums (especially for teachers who may have vision needs) and isn't part of the design token system. | 🟡 Medium | `components/planning/PlanningWorkspace.tsx` |
| **DraftingStation textarea has no `id` or `aria-label`** — the main input area is a raw `<textarea>` with no accessible name. Screen readers will not announce it. | 🟡 Medium | `components/drafting/DraftingStation.tsx` |
| **UTF-8 corruption in metadata** — `installningar/page.tsx` metadata contains `InstÃ¤llningar` (double-encoded ä) and `skolnivÃ¥` instead of proper Swedish characters. This will produce garbled `<title>` tags. | 🟡 Medium | `app/(dashboard)/installningar/page.tsx` |
| **No visual feedback on drafting "Generera" success** — after generation completes the output simply appears in the right panel. There's no toast, scroll-to-output, or panel highlight animation. | 🟢 Low | `components/drafting/DraftingStation.tsx` |
| **"Kopiera" button gives no visible status on mobile** — the `copyStatus` resets after 1.8 seconds. On smaller screens the button may be out of view. | 🟢 Low | `components/drafting/OutputPanel.tsx` |

---

### 3. Onboarding & First-Run Experience

| Finding | Severity | Location |
|---|---|---|
| **No guided first-use experience** — after registration + email confirmation, the user is dropped into `/skrivstation` with zero guidance. No welcome modal, no interactive tour, no sample content pre-loaded. The textarea just says a placeholder text. | 🔴 High | App-wide |
| **Planning onboarding exists but drafting doesn't** — `PlanningOnboardingPanel.tsx` exists for the planning workspace, but the drafting station (the primary product) has no equivalent. | 🟡 Medium | `components/planning/PlanningOnboardingPanel.tsx` |
| **Registration captures `schoolName` but it's never surfaced again** — the school name field is optional, stored in `profiles`, but never shown or used outside of `user_settings`. It feels like abandoned intent. | 🟢 Low | `app/(auth)/registrera/page.tsx` |
| **No empty-state for `/konto` quota** — when a user hasn't used any transforms, the usage summary says `0 av 10 gratis omvandlingar använda` which is fine, but there's no prompt like "Gå till skrivstationen och prova din första omvandling". | 🟢 Low | `lib/billing/entitlements.ts` |

---

### 4. Security & Auth

| Finding | Severity | Location |
|---|---|---|
| **`unsafe-inline` in production CSP for scripts** — the enforced CSP allows `'unsafe-inline'` for scripts in production mode. This significantly weakens the CSP against XSS. The docs acknowledge this as future work (nonce/hash), but it's still a real gap. | 🟡 Medium | `lib/supabase/middleware.ts` |
| **No CSRF protection on server actions** — Next.js server actions don't have built-in CSRF tokens. The `loginAction`, `registerAction`, `updateSettingsAction`, etc. rely on Supabase cookie auth but have no `Origin` header validation. | 🟡 Medium | `app/(auth)/actions.ts` |
| **Non-null assertion on `profile!`** — `konto/page.tsx` uses `profile!` (non-null assertion) 4 times after a guard that doesn't return/redirect on missing profile. The `loadDashboardProfile` call could still return `null`. | 🟡 Medium | `app/(dashboard)/konto/page.tsx` |
| **Password policy lacks special character requirement and breached-password check** — only requires uppercase + lowercase + digit. No symbol requirement, no check against common/breached passwords (e.g., zxcvbn or HaveIBeenPwned API). | 🟢 Low | `lib/auth/password-policy.ts` |
| **Middleware excludes `api/webhooks` from session update** — correct design, but the webhook exclusion pattern is a simple string match, not a regex boundary. A route like `/api/webhooks-fake` would also be excluded. | 🟢 Low | `middleware.ts` |
| **`/admin` middleware protection is route-prefix only** — any route starting with `/admin` is protected, but there's no per-route admin role check in the middleware itself. Admin checking happens at the page/component level via `isCurrentUserAppAdmin()`. This is fine architecturally, but a new admin route added without the check would be accessible to any authenticated user. | 🟢 Low | `lib/supabase/middleware.ts` |

---

### 5. Payment & Billing

| Finding | Severity | Location |
|---|---|---|
| **Billing security is genuinely strong** — idempotent webhooks, event ledger, customer mapping, reconciliation, and fail-closed entitlements. Well-documented in `docs/billing-security.md`. | ✅ Positive | `docs/billing-security.md` |
| **No Swish for monthly subscriptions** — the `paymentMethodTypes` for `monthly` is only `["card"]`, while `onetime` supports `["card", "swish"]`. For a Swedish market product, Swish for recurring is a significant gap (Stripe supports Swish for subscriptions). | 🟡 Medium | `lib/stripe/config.ts` |
| **No pricing A/B testing or plan flexibility** — prices are hardcoded constants (`MONTHLY_PRO_PRICE_SEK = 49`, `ONE_TIME_PASS_PRICE_SEK = 49`). Changing pricing requires a code deploy. | 🟢 Low | `lib/billing/entitlements.ts` |
| **`past_due` immediately revokes access** — documented as intentional, but harsh for a teacher mid-semester. Should be a conscious business decision. | 🟢 Low | `lib/billing/entitlements.ts` |

---

### 6. GDPR & Privacy

| Finding | Severity | Location |
|---|---|---|
| **Client + server dual scrubbing is well-designed** — browser scrubs before sending, server re-scrubs and checks. Output guard validates before returning. This is a solid defense-in-depth model. | ✅ Positive | `lib/gdpr/scrubber.ts`, `lib/gdpr/server-guard.ts` |
| **Name dictionary is hardcoded and finite** — `ALL_SWEDISH_NAMES` is a static list. Names not in the dictionary won't be recognized by the first scrub pass. The `collectLikelyUnknownNameWords` heuristic catches some, but non-Swedish names (Arabic, Somali, etc.) common in Swedish schools are likely under-represented. | 🟡 Medium | `lib/gdpr/patterns.ts` |
| **`SAFE_CAPITALIZED_WORDS` list is manually maintained** — any new Swedish educational term (school name, curriculum acronym) will trigger false warnings. The list has 79 entries but no mechanism to extend it per-school. | 🟢 Low | `lib/gdpr/scrubber.ts` |

---

### 7. AI Generation Pipeline

| Finding | Severity | Location |
|---|---|---|
| **`beginGenerationAttemptFallback` is a 112-line non-atomic fallback** — it reads profile, checks entitlements, resets rate-limit windows, increments transform counts — all as separate Supabase queries without a transaction. Under concurrent requests, race conditions could grant extra transforms. | 🟡 Medium | `app/api/ai/route.ts` |
| **No streaming response** — the AI route collects the full Claude response in-memory via `claudeStream` before sending it. For 2048 max tokens this works, but the user sees no output until generation is complete. Modern UX typically streams. | 🟡 Medium | `app/api/ai/route.ts` |
| **Anthropic API key is checked per request** — `process.env.ANTHROPIC_API_KEY` is checked inside the request handler. This is fine, but a missing key returns a 500 that the user can trigger repeatedly. Should fail fast at startup or module init. | 🟢 Low | `app/api/ai/route.ts` |

---

### 8. Planning Sync

| Finding | Severity | Location |
|---|---|---|
| **Debounce timer is 700ms** — every keystroke in `teacherNotes` triggers a `setTimeout` that fires a cloud sync after 700ms. Rapid typing will create many cancelled/re-scheduled timers and a burst of sync attempts. | 🟡 Medium | `hooks/usePlanningChecklist.ts` |
| **`useEffect` dependency array includes `progressMap` and `teacherNotes` as objects** — these create new references every render, causing the sync effect to re-fire on every state change. This is the core of the rapid sync problem. | 🟡 Medium | `hooks/usePlanningChecklist.ts` |
| **No browser-level failure tests** — the docs honestly list this as missing. Offline/online, tab duplication, and clock drift scenarios are untested. | 🟡 Medium | `docs/audit.md` |

---

### 9. Support Operations

| Finding | Severity | Location |
|---|---|---|
| **Support form has no CAPTCHA or proof-of-work** — anonymous support submissions (if allowed) could be abused. The `abuse-protection.test.ts` exists but unclear what it covers without the source. | 🟢 Low | `app/api/support/` |
| **Retention not yet scheduled** — the `retention-support.mjs` script exists but isn't in any CI/cron schedule. Manual-only. | 🟢 Low | `scripts/retention-support.mjs` |

---

### 10. Testing

| Finding | Severity | Location |
|---|---|---|
| **33 test files with strong backend coverage** — route tests, scrubber tests, entitlement tests, output-guard tests, planning storage/sync tests. Good. | ✅ Positive | Various `__tests__/` dirs |
| **Zero component-level tests** — no tests for `DraftingStation`, `OutputPanel`, `PlanningWorkspace`, `DashboardNav`, or any UI component. User-facing regressions won't be caught. | 🟡 Medium | Missing |
| **No E2E or browser tests** — no Playwright, Cypress, or similar. Critical flows (login → draft → generate → copy) are untested in a real browser. | 🟡 Medium | Missing |
| **`middleware.test.ts` lives at project root** — inconsistent with the `lib/**/__tests__/` pattern used everywhere else. | 🟢 Low | `middleware.test.ts` |

---

### 11. Error Handling & Observability

| Finding | Severity | Location |
|---|---|---|
| **No error tracking integration** — no Sentry, LogRocket, or similar. Errors in production will go unnoticed unless a user reports them. | 🟡 Medium | App-wide |
| **Route error handler logs to console only** — `logRouteError` and `logRouteInfo` are structured but they write to `console`. In Vercel/serverless this works, but there's no alerting pipeline beyond `OPS_ALERT_WEBHOOK_URL`. | 🟡 Medium | `lib/server/request-context.ts` |
| **Client-side errors are silently caught** — multiple `catch {}` blocks in `PlanningWorkspace.tsx` and hooks with no user notification. | 🟢 Low | Various |

---

### 12. Developer Experience

| Finding | Severity | Location |
|---|---|---|
| **No `.prettierrc` or formatting config** — formatting is enforced only by ESLint. No explicit Prettier config for consistent code style. | 🟢 Low | Project root |
| **`dev-stderr.log` and `dev-stdout.log` are committed/present** — 85KB stderr log file in the repo root. Should be in `.gitignore`. | 🟢 Low | Project root |
| **`holding-page/` and `.tmp/` directories exist** — unclear purpose, potentially dead folders. | 🟢 Low | Project root |
| **`types/database.ts` is 26KB generated file** — no generation script documented. If the DB schema changes, how is this regenerated? | 🟢 Low | `types/database.ts` |

---

## Phased Remediation Plan

### Phase 1: Critical Fixes (1–2 days)

These are bugs or gaps that could actively harm users or create maintenance pain right now.

- [x] **Fix UTF-8 corruption** in `installningar/page.tsx` metadata (`InstÃ¤llningar` → `Inställningar`)
- [x] **Add `loading.tsx` and `error.tsx`** to all `(dashboard)` route segments for graceful loading/error states
- [x] **Add React Error Boundary** wrapper around the dashboard layout's `{children}`
- [x] **Fix `profile!` non-null assertions** in `konto/page.tsx` — add proper null guard or redirect
- [x] **Add `id` and `aria-label`** to the DraftingStation textarea
- [x] **Clean up repo noise**: add `dev-stderr.log`, `dev-stdout.log` to `.gitignore`, investigate `holding-page/` and `.tmp/`

Phase 1 notes:

- Dashboard loading/error states are implemented at the `(dashboard)` route group, so all dashboard child routes inherit them.
- `holding-page/` is documented as the intentional static Netlify placeholder. `.tmp/` is ignored and empty. Local `dev-stderr.log` and `dev-stdout.log` files were removed after adding explicit ignore entries.

---

### Phase 2: UX & Code Quality (3–5 days)

Structural improvements to the codebase and user experience.

- [x] **Decompose `PlanningWorkspace.tsx`** into sub-components:
  - `PlanningSelector` (grade band, subject, area dropdowns)
  - `PlanningChecklist` (item list with status buttons)
  - `PlanningGapSummary` (stat cards + gap list)
  - `PlanningCloudSyncPanel` (sync status, queue, conflicts)
  - `PlanningAiPanel` (prompt, generate, copy)
  - `PlanningImportExport` (export/import buttons + messaging)
- [x] **Decompose `usePlanningChecklist.ts`** into smaller hooks:
  - `usePlanningLocalState` (localStorage hydration, progress/notes)
  - `usePlanningCloudSync` (sync, conflict, queue)
  - `usePlanningSyncQueue` (queue CRUD + flush)
- [x] **Refactor the AI route** — extract `beginGenerationAttempt`, `releaseGenerationAttempt`, `recordUsageEvent` into `lib/ai/generation.ts`
- [x] **Fix DashboardNav for mobile** — implement a hamburger menu / sheet drawer for narrow screens
- [x] **Add first-use onboarding** to the Drafting Station — welcome panel with sample content and a walkthrough
- [x] **Increase sync debounce** to 1500–2000ms and stabilize dependency arrays to prevent rapid sync churn
- [x] **Extract duplicated `getValue` helper** into `lib/validations/helpers.ts`
- [x] **Move `middleware.test.ts`** from root to `lib/supabase/__tests__/`
- [x] **Add a proper font loading strategy** — either use `next/font` for Google Fonts (Inter or similar) or serve Aptos self-hosted

Phase 2 notes:

- `PlanningWorkspace.tsx` now delegates selector, checklist, gap summary, cloud sync, AI, and import/export UI to focused components under `components/planning/`.
- `usePlanningChecklist.ts` now delegates local checklist state, cloud sync metadata, and sync queue state to `hooks/planning/usePlanningLocalState.ts`, `hooks/planning/usePlanningCloudSync.ts`, and `hooks/planning/usePlanningSyncQueue.ts`.
- Planning cloud saves now debounce at 1700ms and use stable scope/update signals with a repeated-payload guard to reduce sync churn.
- The dashboard nav uses a mobile menu for narrow screens, and Drafting Station now has a first-run panel with a safe sample draft.
- Fonts are loaded through `next/font/google` using Inter for UI text and Source Serif 4 for display text.

---

### Phase 3: Product Maturity (1–2 weeks)

Features and quality improvements needed before a broader launch.

- [x] **Add component tests** — at minimum for `DraftingStation`, `OutputPanel`, and `DashboardNav` using React Testing Library
- [x] **Add E2E tests** — Playwright tests for the core flow: login → select template → paste notes → generate → copy
- [x] **Implement AI streaming** — return a `ReadableStream` from the AI route and consume with a streaming hook on the client for real-time output
- [x] **Add error tracking** — integrate Sentry or similar for client + server error capture
- [x] **Expand the GDPR name list** — add common non-Swedish names (Arabic, Somali, Finnish, etc.) commonly found in Swedish schools
- [x] **Consider Swish for monthly subscriptions** — check Stripe documentation for Swish as a recurring payment method
- [x] **Add `past_due` grace period** — make a conscious business decision and implement if desired
- [x] **Add CAPTCHA to support form** — if anonymous submissions are allowed, add bot protection
- [x] **Document `types/database.ts` generation** — add a script for `supabase gen types` or similar

Phase 3 notes:

- Added jsdom/React Testing Library coverage for `DraftingStation`, `OutputPanel`, and `DashboardNav`; Playwright now has a credential-gated core flow spec for login → template → notes → generation → copy.
- `/api/ai` now returns a streamed text response while preserving first-chunk output-guard blocking and usage recording.
- Sentry is wired through `instrumentation.ts`, `instrumentation-client.ts`, `app/global-error.tsx`, and `withSentryConfig`; set `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` plus Sentry org/project vars in production.
- GDPR first-pass name coverage now includes common Arabic, Somali, Finnish, and other multicultural names.
- Stripe's payment-method support documentation checked on April 28, 2026: Swish remains unsupported for Checkout subscription mode in this integration, so monthly checkout stays card-only while one-time payment keeps Swish.
- `past_due` now has a 7-day grace period anchored to the latest invoice creation time, stored as `paid_access_until` for recurring entitlements and enforced by the authoritative entitlement decision.
- Support submissions can use Cloudflare Turnstile (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`), with production failing closed if bot protection is missing.
- Added `npm run db:types` via `scripts/generate-db-types.mjs` and documented both `SUPABASE_PROJECT_ID` and `SUPABASE_DB_URL` regeneration paths.

---

### Phase 4: Scale & Polish (ongoing)

Longer-term improvements for production maturity.

- [ ] **Strengthen CSP** — move to nonce/hash enforcement, remove `'unsafe-inline'` for scripts
- [ ] **Add CSRF protection** — validate `Origin` header on server actions
- [ ] **Add breached-password checking** — integrate zxcvbn or HaveIBeenPwned API
- [ ] **Pricing flexibility** — move prices to env/config so changes don't require deploys
- [ ] **Full accessibility audit** — screen reader testing, focus management, colour contrast, keyboard navigation
- [ ] **Add `SAFE_CAPITALIZED_WORDS` extensibility** — allow per-school or per-user safe word lists
- [ ] **Performance audit** — bundle size analysis, lazy-load the planning workspace, code-split admin routes

---

## Open Questions

### Priority decisions needed before Phase 2

1. Should the planning workspace decomposition happen in this pass, or is it too risky to refactor right now?
2. Is the AI streaming response a priority, or is the current "wait then show" UX acceptable for the pilot audience?
3. What is the desired font strategy — Google Fonts via `next/font`, self-hosted Aptos, or keep the current system-font stack?

### Business decisions needed before Phase 3

1. Should `past_due` have a grace period, and if so, how long?
2. Should Swish be enabled for monthly subscriptions (needs Stripe plan check)?
3. Is anonymous support submission intended, or should it require auth?

### Note

The existing `docs/audit.md` covers operational/launch readiness from an infrastructure and policy perspective. This audit focuses on **code quality, UX, and developer experience** — the two are complementary and should be maintained in parallel.
