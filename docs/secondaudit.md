# Audit

This audit covers the entire Skolskribenten codebase as of April 19, 2026. Every source file under `app/`, `components/`, `lib/`, `hooks/`, `types/`, `supabase/migrations/`, and all config/infrastructure files was read in full — two passes were performed. All API routes, dashboard pages, auth flows, content pages, shared components, UI primitives, hooks, library modules, validation schemas, test files, SQL migrations (001-008), `.env.example`, CI configuration, Vitest config, and `components.json` were inspected. Typecheck, lint, and all 42 unit tests pass cleanly. The previous `docs/audit.md` (Phase 1 and 2 completed) was noted but the design and roadmap docs were not re-read per instruction.

---

## Executive Summary

**Code health:** Strong for an MVP. The codebase is well-organized with clear domain boundaries (`lib/ai`, `lib/gdpr`, `lib/billing`, `lib/drafting`, `lib/validations`), consistent patterns across auth/dashboard/content pages, strict TypeScript, Zod validation at every boundary, and meaningful test coverage on business-critical modules. The architecture cleanly separates server components from client components. There is almost no dead code. The main weaknesses are a handful of duplicated constants, a few places where the GDPR scrubber's scope limitations could create real-world failures, and missing error handling for edge cases in the Stripe webhook flow.

**Product readiness:** The core drafting flow is complete and coherent. Auth, billing, settings, and content pages are all functional. The product is close to being testable by real teachers, but there are a few concrete gaps that would hurt credibility: the `"custom"` template type is accepted in AI prompts but falls back to a generic system prompt without template-specific formatting, the output copy flow copies raw markdown rather than the rendered text, and the landing page navigation has no mobile hamburger menu. These are addressable in a short sprint.

---

## What Is Working Well

1. **Clean domain architecture.** `lib/ai/`, `lib/gdpr/`, `lib/billing/`, `lib/drafting/`, `lib/validations/` each own a single concern. No cross-domain coupling.

2. **Server-side safety for billing.** The `begin_generation_attempt` RPC in `008_phase1_safety_hardening.sql` uses `SELECT ... FOR UPDATE` to prevent race conditions on free-tier quota checks. The RLS policy on `profiles` prevents client-side mutation of billing fields. This is genuinely well-designed.

3. **GDPR scrubber is thoughtfully built.** Name replacement uses stable entity mapping (`[Elev 1]`, `[Elev 2]`), structural PII (personnummer, samordningsnummer, phone, email) is scrubbed before names to avoid ordering conflicts, and `collectUnmatchedCapitalizedWords` provides a helpful second-pass warning system.

4. **Server-side GDPR guard.** The API route at `app/api/ai/route.ts` runs `detectPotentialSensitiveContent` on the scrubbed input before calling Claude. This is a real defense-in-depth layer.

5. **Auth flow is complete.** Login, registration, password reset (request + update), email confirmation, error handling, and sign-out all work. Server actions use Zod validation, user-friendly Swedish error messages, and safe redirect sanitization.

6. **Draft persistence.** Per-template, per-user localStorage drafts with 12-hour TTL, legacy key cleanup, and hydration-safe initialization. Draft clearing on sign-out covers both localStorage and sessionStorage.

7. **Consistent visual language.** The design system uses a coherent set of CSS custom properties (`--ss-primary`, `--ss-neutral-*`, etc.) applied consistently across all pages. The `ss-card` utility class and rounded-corner language create a unified feel.

8. **Test coverage on critical paths.** GDPR scrubber (20 tests), server guard (4), entitlements (6), prompts (4), draft storage (3), user settings (5). The tests cover edge cases that matter.

9. **CI pipeline.** GitHub Actions runs typecheck, lint, test, and build on every push/PR. All pass.

10. **Streaming AI response.** The `useCompletion` hook reads the response body as a `ReadableStream`, updating the UI progressively. This is the right UX for document generation.

---

## Critical Findings

### C1. Output copy copies raw markdown, not rendered text

**Severity:** High (UX)
**Why it matters:** The primary user action after generation is copying the document. `OutputPanel.tsx:27` calls `navigator.clipboard.writeText(completion)`, which copies the raw markdown string including `**bold**`, `## headings`, `---` dividers, and `[Elev 1]` brackets. When pasted into Word, Google Docs, DF Respons, or Unikum, the teacher gets markdown syntax rather than formatted text. This directly undermines the product promise of "redo att kopiera direkt."
**Evidence:** `components/drafting/OutputPanel.tsx:27` — `await navigator.clipboard.writeText(completion);`
**Recommended fix:** Use `navigator.clipboard.write()` with `text/html` MIME type, generating HTML from the rendered `DocumentRenderer` output. Alternatively, select the rendered DOM node's content and use `document.execCommand('copy')` or the Clipboard API with HTML. Keep the plaintext fallback.

### C2. No usage limit enforcement in the UI before generation

**Severity:** High (Product)
**Why it matters:** The `DraftingStation` component does not check `hasExceededFreeTransformLimit(profile)` before enabling the "Generera" button. A free-tier user who has used 10/10 transforms can still type notes, add names, and click "Generera" — only to get a 403 error from the API. This wastes the teacher's effort and feels broken.
**Evidence:** `components/drafting/DraftingStation.tsx:148-154` — the button is only disabled by `isLoading` or empty input, never by quota state. Compare with `KontoClient.tsx:28` which does call `hasExceededFreeTransformLimit`.
**Recommended fix:** Pass quota state to `DraftingStation`, disable the generate button when quota is exceeded, and show a clear inline message linking to `/konto`.

### C3. Stripe webhook does not verify idempotency or handle duplicate events

**Severity:** High (Reliability)
**Why it matters:** Stripe can deliver webhook events more than once. The current handler in `app/api/webhooks/stripe/route.ts` unconditionally updates the profile on `checkout.session.completed`. If a duplicate event arrives, it will overwrite `subscription_end_date` for one-time passes with a new `addDays(new Date(), 30)` based on the current time, extending the pass unintentionally.
**Evidence:** `app/api/webhooks/stripe/route.ts:48-55` — `addDays(new Date(), 30)` uses current server time, not the event timestamp.
**Recommended fix:** Store the Stripe `checkout.session.id` in a column or check table, and skip processing if already seen. Alternatively, use `event.created` or session completion time instead of `new Date()`.

### C4. `invoice.payment_failed` webhook handler is empty

**Severity:** Medium-High (Product)
**Why it matters:** When a recurring Pro subscription payment fails, the user should be notified and eventually downgraded. The current handler at line 80-82 is a no-op `break`. The user stays on `subscription_status = "pro"` indefinitely.
**Evidence:** `app/api/webhooks/stripe/route.ts:80-82`
**Recommended fix:** At minimum, send a notification (email or in-app) on payment failure. Consider setting a grace period or downgrading to `"cancelled"` after repeated failures.

### C5. `custom` template type has no specific prompt structure

**Severity:** Medium (Product quality)
**Why it matters:** Users can select "Eget dokument" in the template picker, but `getSystemPrompt("custom")` falls back to `BASE_SYSTEM_PROMPT` without any template-specific formatting instructions (`lib/ai/prompts.ts:154`). Unlike the other four templates which specify exact field structures, the `custom` template gives Claude no structural guidance, resulting in unpredictable output format. The `DocumentRenderer` relies on parsing specific patterns (fields, sections, headings) that the base prompt doesn't instruct Claude to use.
**Evidence:** `lib/ai/prompts.ts:154` — `const basePrompt = templateType === "custom" ? BASE_SYSTEM_PROMPT : TEMPLATE_PROMPTS[templateType];`
**Recommended fix:** Add a `custom` entry to `TEMPLATE_PROMPTS` with formatting instructions that produce a predictable structure the DocumentRenderer can parse.

### C6. `lib/supabase/client.ts` is a dead file — never imported

**Severity:** Low (Dead code / confusion risk)
**Why it matters:** The browser-side Supabase client at `lib/supabase/client.ts` is not imported by any file in the codebase. All client-side operations go through the server client or the admin client. Having an unused 10-line "use client" module creates confusion for contributors who might assume it's the intended browser SDK entry point and start using it — potentially bypassing server-side auth flows.
**Evidence:** `grep -r 'from "@/lib/supabase/client"'` returns zero results.
**Recommended fix:** Delete the file, or if it's being kept for a future client-side feature, add a comment explaining why.

### C7. `.env.example` lists 4 unused environment variables

**Severity:** Low (DX / confusion risk)
**Why it matters:** `.env.example` includes `OPENAI_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, and `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — none of which are referenced anywhere in the codebase. A new developer copying `.env.example` to `.env.local` will spend time looking for values for keys the app doesn't use, or worse, assume observability is already wired up.
**Evidence:** `grep -r` for each key returns zero source code references.
**Recommended fix:** Remove unused keys. If they're placeholders for future integrations, group them under a clear `# Future (not yet wired)` header.

---

## Important Refactors

### R0. No shared dashboard layout — every page loads its own profile and nav

**Files:** `app/(dashboard)/skrivstation/page.tsx`, `app/(dashboard)/installningar/page.tsx`, `app/(dashboard)/konto/page.tsx`, `app/(dashboard)/lektionsplanering/page.tsx`
**Impact:** The `(dashboard)` route group has no `layout.tsx`. Every dashboard page independently calls `loadDashboardProfile()`, renders its own navigation via `DashboardPageActions`, and handles the missing-profile fallback individually. This means:
- Profile data is fetched 1x per navigation (no shared cache at the layout level).
- Navigation links are duplicated and scattered — adding a new dashboard page requires updating nav in 4 separate pages.
- There is no persistent sidebar, tab bar, or header across dashboard pages. Each page feels standalone rather than part of a coherent app shell.

**Recommended fix:** Add an `app/(dashboard)/layout.tsx` that loads the profile once and passes it to children via React context or a server-side layout prop. Render a shared navigation bar or sidebar in this layout.

### R1. Duplicated `escapeRegex` function

**Files:** `lib/gdpr/scrubber.ts:202`, `lib/gdpr/server-guard.ts:129`
**Impact:** Low risk but violates DRY. Both are identical. Extract to a shared utility in `lib/gdpr/patterns.ts` or `lib/utils.ts`.

### R2. Duplicated `SCHOOL_LEVEL_LABELS` and `TONE_LABELS`

**Files:** `components/drafting/DraftingStation.tsx:13-22`, `app/(dashboard)/installningar/page.tsx:56-65`
**Impact:** If a new school level or tone is added, it must be updated in two places. Extract to a shared file, e.g. `lib/validations/user-settings.ts` or a new `lib/ui/labels.ts`.

### R3. `GdprScrubber` is instantiated as a module-level singleton in a hook

**File:** `hooks/useDocumentGeneration.ts:8`
**Impact:** The `GdprScrubber` class uses instance state (`entityCounter`, `entityMap`) that is reset in `scrub()`, so the singleton is technically safe. However, this couples test isolation and makes it non-obvious. Consider making `scrub` a pure function or instantiating the scrubber per call.

### R4. `installningar/page.tsx` is 293 lines with inline form UI

**File:** `app/(dashboard)/installningar/page.tsx`
**Impact:** This server component mixes data loading, option definitions, form layout, and sidebar rendering. The form body could be extracted into a `SettingsForm` component. The sidebar could be a `SettingsSidebar` component. This would improve readability and make the radio-button pattern reusable.

### R5. The `DocumentRenderer` parser could benefit from unit tests

**File:** `components/drafting/DocumentRenderer.tsx:54-157`
**Impact:** The `parseDocument` function is ~100 lines of imperative parsing logic handling 7 block types. It has zero test coverage. Since this is the primary output rendering path and teachers will judge the product by what they see here, regressions in parsing would be high-impact. Extract `parseDocument` to a standalone module and add tests.

### R6. Stripe API version is hardcoded and cast unsafely

**File:** `lib/stripe/server.ts:3,7-10`
**Impact:** `STRIPE_API_VERSION = "2024-06-20"` is over two years old. The `as unknown as NonNullable<...>` cast suppresses type errors, which means the app could silently use deprecated API behavior. Pin deliberately and document why, or upgrade.

### R7. `getFirstIssue` is duplicated across actions files

**Files:** `app/(auth)/actions.ts:60-62`, `app/(dashboard)/installningar/actions.ts:13-15`
**Impact:** Minor duplication. Extract to `lib/validations/` or `lib/auth/redirects.ts`.

---

## Dead Code And Cleanup Candidates

| Item | File | Confidence | Reasoning |
|------|------|------------|-----------|
| `lib/supabase/client.ts` | `lib/supabase/client.ts` | **High** | Browser-side Supabase client. Zero imports in the codebase. Dead file. |
| `.gitkeep` files | `components/drafting/.gitkeep`, `components/gdpr/.gitkeep`, `components/shared/.gitkeep`, `hooks/.gitkeep`, `lib/validations/.gitkeep` | **High** | These directories all contain real files now. The `.gitkeep` files served their purpose during scaffolding and can be removed. |
| `LEGACY_DRAFT_STORAGE_KEY` cleanup check | `lib/drafting/draft-storage.ts:1` | **Medium** | The legacy key is removed on every hydration (`useDraftPersistence.ts:121`). If no users have the v1 key anymore, this cleanup code can be removed. Keep it for now if the product is still in early access. |
| `dev-stderr.log` and `dev-stdout.log` | `.tmp/dev-stderr.log` (29KB), `.tmp/dev-stdout.log` (5KB) | **High** | Development log artifacts in `.tmp/`. Should be in `.gitignore` and removed from the repository. |
| `supabase/seed.sql` | `supabase/seed.sql` (1 byte) | **High** | Empty file. Either add seed data or remove. |
| Unused `.env.example` keys | `.env.example` | **High** | `OPENAI_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — none referenced in source. |
| `docs/design` (55KB) and `docs/roadmap` (222B) | `docs/` | **Medium** | Per user instruction, these are outdated. Consider archiving or deleting to avoid confusion. |
| `resolveRelativeUrl` in `lib/auth/redirects.ts:37-39` | `lib/auth/redirects.ts` | **Low** | Used in `auth/confirm/route.ts`. Not dead, but the thin wrapper over `new URL()` adds marginal value. Keep for consistency. |

---

## Should-Have Functionality

### S1. Mobile navigation on the landing page

**Why:** The landing page header hides navigation links on small screens (`hidden items-center gap-4 lg:flex` at `app/page.tsx:64`). There is no hamburger menu. Mobile users see only "Logga in" and "Prova gratis" buttons, with no way to reach Om oss, Vanliga frågor, or Kontakt. For a product targeting teachers (who often browse on phones), this is a meaningful gap.

### S2. Quota-exceeded state in the drafting station

**Why:** As described in C2. Teachers should see a clear, non-destructive message when their free quota is exhausted, directly in the drafting UI rather than only after a failed API call.

### S3. Per-page `<title>` and meta descriptions on dashboard pages

**Why:** The root layout sets a template (`%s | Skolskribenten`), but the dashboard pages (`skrivstation`, `installningar`, `konto`, `lektionsplanering`) do not export `metadata`. This means the browser tab shows only "Skolskribenten" for all four pages, making it impossible to distinguish tabs. The legal pages (`integritetspolicy`, `anvandarvillkor`) do export metadata correctly.

### S4. Email confirmation feedback loop

**Why:** After registration, the user is redirected to `/logga-in` with a success message saying "Bekräfta din e-postadress och logga sedan in." If the user doesn't receive the email, there is no way to request a new confirmation email from the UI. Supabase supports resending confirmation emails, and a "Skicka bekräftelsen igen" link would prevent support requests.

### S5. Loading state for the konto page Stripe redirects

**Why:** When a user clicks "Välj månadsabonnemang" or "Välj 30-dagarskort" in `KontoClient.tsx`, the `handleCheckout` function fetches the checkout URL and then calls `window.location.assign`. During the fetch, the button shows "Startar betalning..." but the rest of the page remains interactive. If the fetch takes 2-3 seconds (Stripe latency), the user might click other buttons. Consider disabling the entire card or showing a full-page overlay.

### S6. Proper `cancelled` → `free` status transition

**Why:** When a subscription is deleted via webhook (`customer.subscription.deleted`), the profile is set to `subscription_status = "cancelled"`. But the entitlements logic in `isActivePro` only checks for `"pro"` — a `"cancelled"` user is treated identically to `"free"` for access purposes. However, they are shown different labels. There is no mechanism to transition `"cancelled"` back to `"free"` when the user's billing period ends, and `getCurrentPlanLabel` doesn't handle `"cancelled"` specifically. This could confuse users.

---

## Nice-To-Have Later

1. **Rich text copy (HTML clipboard).** Beyond fixing the raw-markdown copy (C1), support `text/html` clipboard for direct paste into Word/Google Docs with formatting.

2. **History of generated documents.** Currently, the generated text disappears on page reload. A lightweight session-level history (not persisted to DB per the privacy model) would let teachers compare drafts.

3. **Keyboard shortcuts.** `Ctrl+Enter` to generate, `Ctrl+Shift+C` to copy output. Teachers working fast would appreciate these.

4. **Dark mode.** The design system has CSS variables ready (HSL-based), and `tailwind.config.ts` has `darkMode: ["class"]`. A toggle would be straightforward.

5. **Printable output.** Add a print stylesheet or "Skriv ut" button so teachers can print the rendered document directly.

6. **Word count / character count** on the input textarea to help teachers gauge whether their notes are sufficient.

7. **Template-specific examples toggle.** The placeholder text in the textarea shows example input, but it disappears once the user types. A "Visa exempeltext" toggle would help first-time users understand what kind of input works well.

8. **Accessibility: focus management after generation.** When generation completes, focus should move to the output panel so screen reader users are aware the result appeared.

9. **Analytics / usage dashboard for the teacher.** Show generation history (template type, date, scrubber stats) from `usage_events`. This data already exists.

10. **Swish payment confirmation page.** Swish payments may take a few seconds to confirm. The current `success_url` redirect may arrive before Stripe confirms the payment.

---

## UI/UX Audit

### Navigation

- **Landing page:** Clean horizontal nav with "Om oss", "Vanliga frågor", "Kontakt" links, but **hidden on mobile** (no hamburger). The CTA hierarchy is clear: "Prova gratis" primary, "Logga in" ghost, "Se skrivstationen" secondary.
- **Dashboard pages:** Navigation between skrivstation/installningar/konto/lektionsplanering uses a consistent `DashboardPageActions` component with pill buttons. The drafting header includes all dashboard nav links. This works but feels scattered — there is no persistent sidebar or tab bar.
- **Content pages:** Use `ContentPageLayout` with breadcrumb-style nav links. Consistent and clear.
- **Legal pages:** Use `LegalPage` with a slightly different nav bar. No major issues.

### Information Hierarchy

- Generally strong. Each page uses the `eyebrow → h1 → description` pattern consistently.
- The settings page sidebar ("Aktivt nu" + "Så används valen") is helpful context that prevents the form from feeling abstract.
- The konto page clearly separates current plan info from upgrade options.

### Workflow Friction

- **Drafting flow:** The left/right split layout works well on desktop. On mobile, the input panel stacks above the output panel, requiring scrolling to see the result. The textarea's `min-h-[24rem]` is generous.
- **Custom names input:** Entering names one at a time via the text field + Enter/button is functional but creates friction when a teacher needs to add 5-10 names. A comma-separated paste would help.
- **Template switching:** Switching templates preserves per-template drafts, which is thoughtful. The warning "Dessa ord kan vara namn som inte kändes igen automatiskt" is a valuable trust signal.

### Visual Consistency

- Consistent use of `ss-card`, `ss-surface`, rounded corners (1.25rem-2rem), and the color palette throughout.
- Font stack relies on system fonts (Aptos, Segoe UI) and Iowan Old Style for display. These are not loaded from Google Fonts, so availability varies by OS. On Linux/Android, both font stacks will fall back to generic sans-serif/serif. **This is a minor visual consistency risk across devices.**

### Empty States

- **Output panel empty state:** Well-handled with template-specific hint text and an explanation of the GDPR model.
- **Loading state:** Skeleton pulse animation is clean.
- **Error state:** Red-bordered card with Swedish error message. Adequate.
- **Missing profile state:** Clear explanation mentioning Supabase migrations. Appropriate for the current dev audience, but would need softening for real users.

### Trust and Polish

- **GDPR badge in the drafting header** is a strong trust signal.
- **Privacy policy and terms** are written in clear Swedish, not generic legalese.
- **Contact form** uses `mailto:` rather than a backend endpoint, which is explicitly explained ("Formuläret öppnar ett färdigt e-postutkast"). This is honest.
- **Pricing section** on the landing page is clear and avoids dark patterns. "Tydliga nivåer utan mörka mönster" is an explicit promise.

### Accessibility

- **Strengths:** `aria-label` on the template picker group, `aria-pressed` on template buttons, `aria-label` on GDPR name removal buttons, `sr-only` for radio inputs, `aria-hidden` on decorative separators.
- **Weaknesses:**
  - The main "Generera dokument" button in `DraftingStation.tsx:147-154` is a raw `<button>` rather than the `Button` component, which is fine functionally but misses the consistent focus ring styling.
  - FAQ `<details>` elements use `marker:hidden` but the `+` icon is a text character, not a proper accessible state indicator. The `group-open:rotate-45` turns `+` into `×`, which works visually but has no `aria-expanded` attribute.
  - No skip-to-content link on any page.
  - The landing page's decorative gradient blobs use `aria-hidden` via `-z-10` positioning but are not explicitly hidden from screen readers.

### Mobile Responsiveness

- Landing page sections use responsive grid classes (`lg:grid-cols-*`, `md:grid-cols-*`) that collapse gracefully.
- The drafting station uses `lg:flex-row` with `flex-col` fallback, so the input→output panels stack vertically on mobile.
- Auth pages use a `lg:grid-cols-[0.95fr_1.05fr]` layout that stacks on mobile.
- **Gap:** As noted, the landing page nav links are hidden on mobile with no alternative navigation.

---

## Phased Implementation Plan

### Phase 1: Critical Correctness and MVP Blockers (✅ Completed)

**Goal:** Fix issues that could cause user-visible failures, data integrity problems, or erode trust during testing.

**Tasks:**
1. ✅ **Fix raw markdown copy** (C1) — Implement HTML clipboard copy in `OutputPanel.tsx`. 
2. ✅ **Add quota-exceeded guard to DraftingStation** (C2) — Pass `transforms_used_this_month` and `subscription_status` into the component, disable the generate button, show inline upgrade CTA. 
3. ✅ **Fix Stripe webhook idempotency** (C3) — Use event timestamp instead of `new Date()` for one-time pass expiry. Add session ID check or upsert guard. 
4. ✅ **Handle `invoice.payment_failed`** (C4) — At minimum, log prominently. Ideally, add a `payment_failed_at` column and show a warning on the konto page. 
5. ✅ **Add mobile navigation to landing page** (S1) — Hamburger menu or slide-out drawer. 
6. ✅ **Add `metadata` exports to dashboard pages** (S3) — Add `title` to skrivstation, installningar, konto, lektionsplanering pages. 
7. ✅ **Delete dead `lib/supabase/client.ts`** (C6) — Remove unused browser client. 
8. ✅ **Clean up `.env.example`** (C7) — Remove or label unused env vars. 

**Expected impact:** Eliminates the highest-risk user-facing issues. After this phase, the product is safe for broader human testing.

**Dependencies:** None. All tasks are independent.

---

### Phase 2: High-Value Refactors

**Goal:** Reduce duplication, improve test coverage on critical rendering code, and clean up technical debt.

**Tasks:**
1. **Extract shared `escapeRegex`** (R1) — Move to `lib/gdpr/patterns.ts`. Update imports in `scrubber.ts` and `server-guard.ts`. Estimated: 15 minutes.
2. **Extract `SCHOOL_LEVEL_LABELS` and `TONE_LABELS`** (R2) — Move to `lib/validations/user-settings.ts` or a new shared constants file. Update imports in `DraftingStation.tsx` and `installningar/page.tsx`. Estimated: 20 minutes.
3. **Extract `getFirstIssue`** (R7) — Move to a shared validation utility. Estimated: 10 minutes.
4. **Add unit tests for `parseDocument` in DocumentRenderer** (R5) — Extract `parseDocument` and `renderInlineContent` logic to `lib/drafting/document-parser.ts`. Add tests for all 7 block types, inline content with `**bold**` and `[Elev 1]` brackets, edge cases like empty input and incomplete markdown. Estimated: 3-4 hours.
5. **Add a `custom` template prompt** (C5) — Write formatting instructions for the "Eget dokument" template so the AI produces a structure that `DocumentRenderer` can parse predictably. Estimated: 1-2 hours.
6. **Clean up dead files** — Remove `.gitkeep` files, `.tmp/dev-stderr.log`, `.tmp/dev-stdout.log`, `supabase/seed.sql`. Add `.tmp/` to `.gitignore`. Estimated: 15 minutes.
7. **Add shared dashboard layout** (R0) — Create `app/(dashboard)/layout.tsx` with shared profile loading and persistent navigation. Estimated: 3-4 hours.

**Expected impact:** Reduces cognitive load for future contributors, prevents regression in the rendering pipeline, eliminates all identified duplication, and creates a proper app shell.

**Dependencies:** None. Can run in parallel with Phase 1.

---

### Phase 3: UX Polish and Product Completeness

**Goal:** Smooth out the remaining rough edges that would affect teacher perception during testing.

**Tasks:**
1. **Email confirmation resend link** (S4) — Add a "Skicka bekräftelsen igen" button on the login page when showing the "Bekräfta din e-postadress" message. Estimated: 2-3 hours.
2. **Improve custom names input** — Support comma-separated paste and batch addition. Estimated: 1-2 hours.
3. **FAQ accessibility** — Add `aria-expanded` to `<details>` elements. Add skip-to-content link to root layout. Estimated: 1 hour.
4. **Refactor `installningar/page.tsx`** (R4) — Extract `SettingsForm` and `SettingsSidebar` components. Estimated: 1-2 hours.
5. **Add word/character count to input textarea** — Simple character counter below the textarea. Estimated: 30 minutes.
6. **Handle `"cancelled"` status label** (S6) — Add explicit handling in `getCurrentPlanLabel` and on the konto page. Estimated: 1 hour.
7. **Focus management after generation** — Move focus to the output panel header when generation completes. Estimated: 30 minutes.
8. **Web font fallback** — Consider loading Inter or similar from Google Fonts to ensure consistent rendering across OSes. Estimated: 1 hour.

**Expected impact:** The app feels polished enough for confident teacher testing. Accessibility is improved.

**Dependencies:** Phase 1 should be complete before this phase starts (particularly quota guard and mobile nav).

---

### Phase 4: Deferred Enhancements

**Goal:** Features that add value but are not required for MVP credibility.

**Tasks:**
1. Rich text HTML clipboard copy (beyond basic fix in Phase 1).
2. Session-level generation history.
3. Keyboard shortcuts for generate and copy.
4. Dark mode toggle.
5. Print stylesheet / "Skriv ut" button.
6. Teacher usage dashboard from `usage_events`.
7. Stripe API version upgrade (R6).
8. Lektionsplanering module implementation.

**Expected impact:** Differentiation and retention features.

**Dependencies:** Core product must be stable first (Phases 1-3).

---

## Verification Gaps

| What could not be verified | Why | Recommended action |
|----------------------------|-----|--------------------|
| Stripe end-to-end flow (checkout → webhook → profile update) | No Stripe test mode keys configured locally | Run a manual Stripe test mode checkout and verify the webhook fires correctly and the profile is updated |
| Supabase RLS policies in practice | No Supabase instance accessible during audit | Test with Supabase Studio: attempt to update `subscription_status` via the client SDK (should be blocked by the hardened RLS policy in migration 008) |
| Email confirmation flow | Requires a real or test SMTP setup | Sign up with a test email, confirm, and verify the `/auth/confirm` route works end-to-end |
| Production build | Not attempted during this audit | Run `pnpm build` and verify no runtime errors. The CI does this, but local verification is recommended before deployment |
| Mobile rendering | No browser testing performed | Open the app on an actual phone or use Chrome DevTools mobile emulation to verify the responsive layouts |
| Swish payment flow | Swish-specific Stripe integration was not testable | Verify with Stripe's Swish test mode that the payment confirmation arrives correctly |
| DocumentRenderer output quality with real Claude responses | No AI API calls were made | Generate documents with each template type and verify the `parseDocument` function handles the actual Claude output format correctly |
| GDPR scrubber with diverse Swedish names | Only the hardcoded name list was reviewed | Test with real classroom scenarios including compound names, non-Swedish names (Mohammed, Amir), and names that are also common Swedish words |

---

## Final Recommendation

**Is the codebase ready for broader human testing?**

**Conditionally yes**, with the following prerequisites:

1. **Must fix before testing:** Items C1 (raw markdown copy), C2 (quota guard in UI), and S1 (mobile nav). These directly affect the core user experience and would cause immediate confusion in testing. Estimated total: 5-9 hours of focused work.

2. **Should fix before testing:** Items C3 (webhook idempotency) and C4 (failed payment handling). These are less likely to surface during a small test group but could cause billing issues if they do.

3. **Can ship as-is for testing:** Everything else. The codebase is structurally sound, the auth flow is complete, the billing UI is clear, the GDPR model is well-implemented, and the content pages are well-written. The design is cohesive and professional.

The codebase reflects a focused, disciplined build. The architecture is clean enough that a second developer could contribute without extensive onboarding. The main risk is not code quality — it's the handful of user-facing gaps (copy flow, quota guard, mobile nav) that would undermine first impressions during testing.
