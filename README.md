# Skolskribenten

Skolskribenten is a Next.js web app for Swedish teachers who need to turn raw classroom notes into polished documentation faster, without sending identifiable student data to an AI model.

Current repo status:
- advanced MVP / controlled-pilot stage
- the current production-readiness roadmap lives in `docs/audit.md`
- `docs/design` is historical build/reference material, not current implementation truth

## Core Promise

Skolskribenten is built around privacy by design:
- raw notes are scrubbed in the browser before any AI request
- the app does not store the teacher's raw input text
- the app does not store the generated output text
- the database stores account data, billing state, planning state, support requests, and usage metadata

## What The App Does

Skolskribenten currently supports two main teacher workflows:

1. Drafting school documentation
- incident reports
- learning logs
- Unikum-ready documentation
- weekly letters
- custom structured drafts

2. Planning teaching
- curriculum checklist coverage per subject and area
- gap analysis
- cloud sync for Pro users
- conflict handling and recovery
- AI-assisted next-step planning

The live app includes:
- Supabase Auth with email/password flows
- protected dashboard routes
- a client-side GDPR scrubber for Swedish names and common PII
- support for extra manually added names before generation
- template-specific examples in the drafting station
- local draft autosave in the browser
- a live planning workspace at `/lektionsplanering`
- teacher preferences for school level and tone
- Stripe checkout for monthly Pro and 30-day passes
- Stripe billing portal access for recurring subscribers
- server-side contact/support intake
- contact, about, FAQ, privacy, and terms pages

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres
- Stripe
- Anthropic Claude
- Zod
- Vitest

## Privacy Model

Skolskribenten is built around a strict GDPR-conscious flow:

1. The teacher writes notes in the browser.
2. The GDPR scrubber replaces names and other identifiers locally.
3. Only the scrubbed text is sent to `/api/ai`.
4. The AI response is streamed back to the browser.
5. The database stores usage metadata and app state only, never the raw pedagogical content.

This is the product's most important architectural rule.

## Main Routes

Public routes:
- `/`
- `/registrera`
- `/logga-in`
- `/aterstall`
- `/om-oss`
- `/vanliga-fragor`
- `/kontakt`
- `/integritetspolicy`
- `/anvandarvillkor`

Protected dashboard routes:
- `/skrivstation`
- `/lektionsplanering`
- `/installningar`
- `/konto`

Main API routes:
- `/api/ai`
- `/api/planning/checklist`
- `/api/support`
- `/api/stripe/checkout`
- `/api/stripe/portal`
- `/api/webhooks/stripe`

## Environment Variables

Create `.env.local` and configure:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY_PRO=
STRIPE_PRICE_ONETIME_30DAY=

# Operations
APP_ENV=development
OPS_ALERT_WEBHOOK_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:
- the app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a fallback
- the server admin client uses `SUPABASE_SECRET_KEY` with `SUPABASE_SERVICE_ROLE_KEY` as a fallback
- `OPS_ALERT_WEBHOOK_URL` is optional and forwards sanitized route failures plus request IDs to your incident channel

## Local Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev
```

Open `http://localhost:3000`.

## Database Notes

Supabase migrations live in `supabase/migrations/`.

The current local migration set runs through:
- `011_add_planning_template_type.sql`

The live app expects at least:
- `profiles`
- `usage_events`
- `planning_checklists`
- `support_requests`
- RLS policies
- the generation-attempt quota functions
- the monthly reset / entitlement maintenance SQL jobs

## Current Product Scope

Implemented now:
- marketing, legal, auth, settings, and account surfaces
- drafting station with GDPR scrubber, rendered output, and local draft recovery
- planning workspace with checklist state, cloud sync, conflict handling, import/export, and direct AI generation
- recurring and one-time billing flows
- recurring billing portal access
- server-side support intake
- middleware security headers and route-level tests around the protected server surface

Known deliberate limitations:
- the product is not yet production-ready; use `docs/audit.md` for the current gap list and phased plan
- planning sync is best-effort, not collaboration-grade versioned sync
- some launch-signoff work still depends on manual or live-environment verification

## Repository

GitHub: `https://github.com/Veno89/skolskribenten`
