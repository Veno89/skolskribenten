# Audit
This document tracks only the work that is still open after comparing the current codebase against the earlier audit/planning documents and then implementing another round of fixes on April 20, 2026.

Short version: most of the previously documented gaps are now closed. This file is now the single source of truth for what still remains.

Implemented since the older audit documents:
- The planning workspace is now live in `app/(dashboard)/lektionsplanering/page.tsx` with local persistence, cloud sync, conflict UI, onboarding, import/export, and direct AI generation.
- Output copy now supports HTML/plain-text clipboard in `components/drafting/OutputPanel.tsx`.
- Free-tier quota blocking is enforced in the drafting UI in `components/drafting/DraftingStation.tsx`.
- Stripe checkout/webhook handling is materially safer than before in `app/api/stripe/checkout/route.ts` and `app/api/webhooks/stripe/route.ts`.
- Dashboard navigation/layout and page metadata are now in place.
- Shared label helpers, shared validation helpers, shared GDPR regex escaping, and document-parser tests have been added.
- Contact/support now has a real server-side submission path via `app/api/support/route.ts`, `components/shared/ContactForm.tsx`, and `supabase/migrations/010_support_requests.sql`.
- Login now exposes a resend-confirmation flow in `app/(auth)/actions.ts` and `app/(auth)/logga-in/page.tsx`.
- Extra GDPR names now support bulk paste/merge in `components/gdpr/GdprNameInput.tsx` and `lib/gdpr/custom-names.ts`.
- The stale "coming soon" lektionsplanering copy has been removed from `app/vanliga-fragor/page.tsx`.
- A skip link and small FAQ keyboard/focus improvements are now in place.
- Route/middleware coverage now exists for `app/api/ai/route.ts`, `app/api/planning/checklist/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/portal/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/support/route.ts`, `lib/supabase/middleware.ts`, and `middleware.ts`.
- The settings page has been split so `app/(dashboard)/installningar/page.tsx` now just loads data and renders `components/dashboard/settings/SettingsPageContent.tsx`.
- `hooks/useDocumentGeneration.ts` no longer shares a module-level `GdprScrubber` instance across the app runtime.
- The unused `@radix-ui/react-tooltip` dependency has been removed from `package.json` and `pnpm-lock.yaml`.

## Remaining Work

### 1. Continue the planning module beyond the current MVP scope
Why it is still open:
- `lib/planning/curriculum.ts` is still limited to `historia`, `religion`, and `samhallskunskap` for `7-9`.
- `lib/planning/cloud-merge.ts` still uses a deliberately simple merge strategy: highest checklist status wins and notes are concatenated.
- `components/planning/PlanningWorkspace.tsx` sends direct generation through the generic `custom` route and displays the result as raw text, not as a planning-specific rendered format.

What to do:
- Expand the subject/year catalog.
- Improve sync recovery and replay control beyond the current queue + basic merge model.
- Tune direct planning generation toward clearer planning-specific output structures.

### 2. Finish the accessibility and manual mobile follow-up from the earlier audits
Why it is still open:
- There is still no recorded axe/screen-reader pass or manual mobile audit in the repo.

What to do:
- Run and document a deliberate accessibility/mobile pass instead of relying only on responsive CSS and component semantics.

### 3. Clean up the remaining low-priority technical debt from the older audits
Still open:
- `lib/stripe/server.ts` still hardcodes and force-casts the Stripe API version.
- Local draft persistence is still fixed behavior rather than a user-controlled privacy preference.

What to do:
- Treat these as cleanup/follow-up work, not blockers.

### 4. Decide whether `cancelled` should remain a long-lived subscription state
Why it is still open:
- `app/api/webhooks/stripe/route.ts` sets `subscription_status` to `"cancelled"` on deletion/failure paths.
- `lib/billing/entitlements.ts` effectively treats anything that is not active Pro as free from an entitlement perspective.

What to do:
- Either keep `"cancelled"` as a meaningful product/ops state and surface it clearly, or normalize it back to `"free"` when that distinction is no longer useful.

## Verification
Local verification rerun on April 20, 2026:
- `pnpm.cmd typecheck`
- `pnpm.cmd test`
- `pnpm.cmd lint`
- `pnpm.cmd build`

Result:
- All four passed.
- The test suite now passes with 105 tests.
- The repo now includes a tested support route and the migration for persisted support intake.
- The repo now includes route/middleware coverage for the protected server surface called out in the earlier audits.
- A small lint/build blocker in `components/planning/PlanningWorkspace.tsx` was fixed during this audit cleanup.

## Current Recommendation
The next best use of effort is:
1. Planning-module follow-through.
2. Manual accessibility/mobile verification.
3. Low-risk cleanup around billing/status semantics and technical debt.
