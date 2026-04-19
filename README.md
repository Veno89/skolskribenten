# Skolskribenten

Skolskribenten is a Next.js web app for Swedish teachers who need to turn raw classroom notes into polished documentation faster, without sending identifiable student data to an AI model.

The core product promise is privacy by design:
- raw notes are scrubbed in the browser before any network request
- the app never stores the teacher's raw input text
- the app never stores the generated document text
- only account data, subscription data, and usage metadata are saved

## What The App Does

Skolskribenten helps teachers generate:
- incident reports
- learning logs
- weekly letters
- custom structured drafts

The app includes:
- Supabase Auth with email/password flows
- protected dashboard routes
- a client-side GDPR scrubber for Swedish names and common PII
- support for extra manually added names before generation
- per-user usage tracking and free-tier limits
- Stripe checkout for monthly Pro and 30-day passes
- teacher preferences for school level and tone

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
5. The database stores usage metadata only, never the pedagogical content itself.

This is the product's most important architectural rule.

## Main Routes

- `/` Landing page
- `/registrera` Sign up
- `/logga-in` Sign in
- `/aterstall` Password reset
- `/skrivstation` Protected drafting station
- `/installningar` Protected teacher preferences
- `/konto` Protected billing and subscription page
- `/api/ai` AI generation endpoint
- `/api/stripe/checkout` Stripe checkout session endpoint
- `/api/webhooks/stripe` Stripe webhook handler

## Environment Variables

Create `.env.local` and configure:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY_PRO=
STRIPE_PRICE_ONETIME_30DAY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Local Development

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

Open `http://localhost:3000`.

## Database Notes

Supabase migrations live in `supabase/migrations/`.

The project currently expects at least:
- `profiles`
- `usage_events`
- RLS policies
- the monthly reset function/job
- the one-time-pass expiry function/job

## Current Product Status

Implemented:
- landing page
- auth flow
- protected dashboard
- drafting station
- account and billing UI
- settings and prompt personalization
- hosted Supabase schema setup

Next likely milestone:
- add the production Anthropic key and test the full generation flow end to end

## Repository

GitHub: `https://github.com/Veno89/skolskribenten`
