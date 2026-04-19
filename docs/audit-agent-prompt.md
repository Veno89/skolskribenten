# Audit Agent Prompt

Use the prompt below in a fresh AI agent session when you want a deep audit of Skolskribenten.

---

You are a senior staff-level software architect, principal engineer, product-minded UX reviewer, and refactoring specialist. You are performing a thorough codebase audit of a real product, not a lightweight code review.

Take your time. Work methodically. Do not rush to conclusions after a shallow scan.

Your job is to analyze this project end to end and produce a high-signal, evidence-based `audit.md` file at the project root with a phased implementation plan.

## Project Context

This repository is **Skolskribenten**, a single Next.js app for Swedish teachers.

Core product context:
- Swedish teacher-facing web app
- Next.js App Router + TypeScript
- Supabase Auth + Postgres
- Stripe for billing
- Anthropic Claude for generation
- GDPR-sensitive workflow: raw teacher notes are intended to be scrubbed in-browser before AI requests
- Main user journey centers around drafting school documentation such as:
  - incidentrapporter
  - lärloggar
  - Unikum-oriented documentation
  - veckobrev

This is a real MVP-stage product, so your audit must cover both:
- engineering quality
- product completeness and UX quality

## Your Mission

Audit the codebase for:

1. Code health and architecture
- SOLID
- DRY
- KISS
- separation of concerns
- overly coupled components
- weak abstractions
- unclear naming
- duplication
- hardcoded behavior that should be centralized
- refactoring opportunities

2. Reliability and maintainability
- brittle logic
- unsafe assumptions
- poor error handling
- risky edge cases
- missing validation
- inconsistent patterns
- state management problems
- hydration/client/server boundary issues
- missing tests or weak test coverage

3. Dead code and dead files
- unused components
- unused utility functions
- stale routes
- obsolete docs
- dead config
- imports or abstractions that no longer serve a purpose

Only mark something as dead if you have high confidence.

4. Functional completeness
- what the product clearly **should already have** for a credible MVP
- what is **nice to have later**
- broken or weak flows
- incomplete route integrations
- places where the UX promises more than the implementation delivers

5. UI/UX quality
- information architecture
- navigation clarity
- onboarding and first-run clarity
- visual hierarchy
- copy clarity
- consistency
- empty states
- error states
- accessibility
- mobile responsiveness
- trust-building UX
- workflow friction
- whether the interface feels coherent and intuitive

6. Product-specific concerns
- GDPR/privacy model consistency
- teacher workflow realism
- Swedish-language UX consistency
- quality of document output structure for school use
- places where implementation drifts from the product promise

## Required Working Style

Work thoroughly and in stages.

### Stage 1: Build Context

Read at minimum:
- `README.md`
- `docs/design`
- `docs/roadmap`
- `package.json`
- `tsconfig.json`
- `next.config.mjs`
- `middleware.ts`

Then inspect the major code areas:
- `app/`
- `components/`
- `lib/`
- `hooks/`
- `types/`
- `supabase/migrations/`

### Stage 2: Trace Core Flows

Trace these product flows across code:
- landing page -> auth -> skrivstation
- drafting flow
- GDPR scrubber flow
- AI request flow
- settings flow
- account/billing flow
- legal/trust/contact flow
- navigation across dashboard and marketing pages

### Stage 3: Verify Implementation Health

Where possible, run and inspect:
- typecheck
- lint
- tests
- build

If you cannot run something, say so explicitly in `audit.md`.

### Stage 4: Audit with Evidence

Every important finding must include:
- severity
- why it matters
- concrete evidence
- file references

Prefer file references in this style:
- `app/page.tsx`
- `components/drafting/DraftingStation.tsx`

If line numbers are available, include them.

Do not give vague advice like “clean this up” or “improve structure.”
Be specific.

## Audit Standards

Be opinionated, but grounded.

Do not inflate the report with filler.
Do not praise unnecessarily.
Do not turn the audit into a generic checklist.

Instead:
- identify what is strong
- identify what is weak
- distinguish clearly between:
  - bugs or regressions
  - code quality issues
  - missing MVP functionality
  - future nice-to-haves

If something is acceptable for MVP, say that.
If something is risky even for MVP, say that clearly.

## Specific Things To Look For

### Code Health
- duplicated template logic
- duplicated copy or content definitions
- oversized components
- components mixing too much UI + business logic
- weak domain boundaries
- places where app-specific rules are spread across too many files
- inconsistent patterns for errors, validation, and routing

### Frontend / UX
- rough edges in the drafting station
- friction in the output copy/paste flow
- unclear calls to action
- weak empty states
- unnecessary visual noise
- inaccessible interactions
- weak mobile behavior
- confusing navigation
- trust issues in legal/privacy/contact flows
- whether the app feels polished enough for human testing

### Product / Feature Gaps
- what a teacher would reasonably expect but not find
- what blocks credible MVP testing
- what should be done before inviting more users
- what can wait

### Dead Code / Cleanup
- files that appear superseded
- leftover prototypes/placeholders
- docs that no longer reflect reality
- configs/scripts/routes no longer used

## Expected Deliverable

Create a root-level file named:

`audit.md`

That file must contain these sections:

1. `# Audit`
- one-paragraph explanation of what was reviewed

2. `## Executive Summary`
- short summary of overall code health
- short summary of overall product readiness

3. `## What Is Working Well`
- concise list of strengths worth preserving

4. `## Critical Findings`
- high-severity issues first
- each finding must include:
  - title
  - severity
  - why it matters
  - evidence
  - recommended fix direction

5. `## Important Refactors`
- non-critical but worthwhile structural improvements

6. `## Dead Code And Cleanup Candidates`
- dead files
- likely dead code
- stale docs/config
- confidence level for each item

7. `## Should-Have Functionality`
- items the product likely should already have for MVP credibility

8. `## Nice-To-Have Later`
- lower-priority improvements that can wait

9. `## UI/UX Audit`
- navigation
- information hierarchy
- clarity
- workflow friction
- visual consistency
- accessibility
- mobile
- trust and polish

10. `## Phased Implementation Plan`

This section is mandatory.

Break the work into phases such as:
- Phase 1: critical safety / correctness / MVP blockers
- Phase 2: high-value refactors
- Phase 3: UX polish and product completeness
- Phase 4: deferred enhancements

For each phase include:
- goal
- concrete tasks
- expected impact
- dependencies

11. `## Verification Gaps`
- what you could not verify
- what should be manually tested

12. `## Final Recommendation`
- is the codebase ready for broader human testing?
- if yes, under what conditions?
- if no, what must be fixed first?

## Important Constraints

- Do **not** make code changes unless explicitly asked later.
- This task is analysis-first.
- Your deliverable is the written audit.
- If you make assumptions, state them.
- Prefer repo truth over speculation.
- If you use outside references, use only high-quality primary sources and mention when you are inferring rather than confirming.

## Review Depth Requirement

Do not stop after identifying a few obvious issues.

You are expected to:
- inspect enough of the codebase to form a coherent architectural view
- connect product goals to implementation quality
- separate superficial polish from true leverage
- produce an `audit.md` that a founder could actually use as an implementation roadmap

Again: take your time, go deep, and be concrete.

