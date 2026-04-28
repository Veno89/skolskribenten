# Billing Security Model

Last updated: April 28, 2026.

This document is the operating contract for account, Stripe billing, and entitlement state. Stripe is the payment source of truth. The local database is a durable, idempotent projection of Stripe state plus Skolskribenten's account entitlement decision.

Stripe references used for the billing hardening pass:
- Checkout fulfillment: https://docs.stripe.com/checkout/fulfillment
- Webhook receiving and signature verification: https://docs.stripe.com/webhooks
- Subscription webhook events and statuses: https://docs.stripe.com/billing/subscriptions/webhooks
- Idempotent requests: https://docs.stripe.com/api/idempotent_requests
- Billing portal sessions: https://docs.stripe.com/api/customer_portal/sessions/create

## Threat Model

Assets:
- Paid entitlement state and transform quota.
- Canonical Supabase user to Stripe customer mapping.
- Stripe subscription, checkout session, and payment event history.
- Server secrets: Stripe secret key, webhook secret, Supabase service role key.

Attackers:
- Anonymous browser users.
- Authenticated users trying to self-upgrade, swap price IDs, or reuse another user's Stripe object.
- Network callers replaying webhook bodies or sending forged signatures.
- Benign operational failures: duplicate events, delayed events, out-of-order events, failed retries, stale local state.

Primary trust boundaries:
- Browser to Next API routes.
- Next API routes to Supabase with user cookies.
- Next server/service role to Supabase privileged RPCs.
- Stripe to webhook endpoint.
- Next server to Stripe API.
- Reconciliation job to Stripe and Supabase.

Security rules:
- Redirects never grant access.
- Client input never selects raw price IDs, user IDs, customer IDs, subscription IDs, or entitlement fields.
- Checkout and portal sessions are created server-side for the authenticated user.
- Webhooks verify Stripe signatures with the raw body before any event processing.
- Paid access changes only through verified Stripe webhooks, reconciliation repair, or future explicit admin flows.
- Failure defaults to no paid access except for the documented 7-day `past_due` grace window.

## Local Billing Projection

Tables added in `supabase/migrations/013_billing_hardening.sql`:
- `stripe_customer_mappings`: one canonical `user_id` to `stripe_customer_id` mapping, both unique.
- `stripe_checkout_sessions`: durable checkout-session records keyed by Stripe Checkout Session ID.
- `stripe_subscriptions`: durable subscription projection keyed by Stripe Subscription ID.
- `account_entitlements`: current local entitlement decision with source, reason, last event, and reconciliation timestamp.
- `stripe_events`: durable event ledger with event ID, type, object ID, Stripe creation timestamp, processing attempts, status, and error details.

`supabase/migrations/014_authoritative_entitlement_hardening.sql` tightens the projection further:
- backfills `account_entitlements` for existing profiles and creates a default free entitlement row for new signups
- calculates generation quota from `account_entitlements`, not from the profile projection
- rejects checkout/subscription projection updates when an existing Stripe object is already tied to a different user or customer
- allows a stuck `processing` Stripe event to be reclaimed after a 5 minute worker-death timeout
- keeps webhook ledger payloads intentionally minimal so Stripe customer details are not copied into local event storage

`supabase/migrations/015_past_due_grace_period.sql` adds the bounded recurring-subscription grace model for `past_due` states.

Concurrency is handled in database RPCs using row locks:
- `record_stripe_customer_mapping`
- `claim_stripe_event`
- `complete_stripe_event`
- `record_checkout_session_created`
- `apply_checkout_session_projection`
- `apply_subscription_projection`

`profiles.subscription_status`, `profiles.subscription_end_date`, and `profiles.stripe_customer_id` remain as the backwards-compatible app projection. They are updated from `account_entitlements`, not trusted as the source of payment truth for paid API gates, Checkout blocking, Customer Portal access, cloud sync, or generation quota.

Runtime display/pricing configuration:
- Stripe Price IDs still come from the approved Stripe price env vars used by Checkout.
- App copy and local pass duration read `BILLING_MONTHLY_PRO_PRICE_SEK`, `BILLING_ONE_TIME_PASS_PRICE_SEK`, and `BILLING_ONE_TIME_PASS_DURATION_DAYS`.
- Defaults are 49 SEK/month, 49 SEK one-time pass, and 30 days.
- Invalid local pricing env values fail at runtime instead of silently showing misleading prices.

## State Machine

Account:
- Anonymous: no account, no checkout or portal.
- Authenticated profile: may be `free`, `cancelled`, or `pro` in the local projection.
- Stripe customer mapped: exactly one canonical customer per user in `stripe_customer_mappings`.
- Checkout session created: server-owned session with approved price, client reference, metadata, and idempotency key.
- Entitled: only after a verified webhook or reconciliation repair applies the Stripe-derived state.

One-time pass:
- `checkout.session.completed` with `payment_status=paid`: grant the configured pass duration, default 30 days.
- `checkout.session.completed` with `payment_status=unpaid`: record session, no paid access.
- `checkout.session.async_payment_succeeded`: grant the configured pass duration, default 30 days.
- `checkout.session.async_payment_failed`: record failure, no paid access.
- Expired local pass: `expire_one_time_passes` moves entitlement back to free/cancelled projection.
- Missing `account_entitlements` row: no paid access. Migration `014` backfills rows and the signup trigger creates new free rows, so absence is treated as a fail-closed anomaly.

Recurring subscription:

| Stripe status | Local entitlement |
| --- | --- |
| `trialing` | Pro active |
| `active` | Pro active |
| `past_due` | Pro active during the 7-day grace period when a grace anchor exists; no paid access after grace expiry or if the anchor is missing |
| `unpaid` | No paid access |
| `canceled` | No paid access |
| `paused` | No paid access |
| `incomplete` | No paid access |
| `incomplete_expired` | No paid access |

Invoice events (`invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`) retrieve the current subscription from Stripe and reapply the subscription projection.

Out-of-order handling:
- The database stores the latest processed event timestamp per checkout session and subscription.
- Older events are skipped and do not overwrite newer local state.
- Webhook handlers retrieve Checkout Sessions or Subscriptions from Stripe before fulfillment when possible.

Duplicate handling:
- `stripe_events.stripe_event_id` is primary key.
- `claim_stripe_event` returns `should_process=false` for processed or in-flight duplicates.
- Failed events can be retried and increment `processing_attempts`.
- In-flight events can be reclaimed after 5 minutes if a worker died before calling `complete_stripe_event`.

## Abuse Cases Covered

Before:
- Recurring checkout completion could directly mark a profile as Pro without a durable event ledger.
- Stripe customer creation had no idempotency key or canonical mapping table.
- Webhook processing was not durably idempotent.
- Subscription lifecycle states were only partially modeled.
- Payment failures were handled with an implicit retry count policy, not a clear entitlement state machine.

After:
- Redirect success only shows pending copy; it does not grant access.
- Checkout accepts only server-owned `monthly` or `onetime` keys and maps them to validated env price IDs.
- Customer and Checkout creation use Stripe idempotency keys.
- Customer, session, subscription, event, and entitlement state have uniqueness constraints.
- Existing checkout session and subscription rows reject identity mismatches instead of being reassigned across users/customers.
- Webhook events are raw-body signature verified, claimed, processed, and completed in the event ledger.
- Webhook processing validates approved prices and customer mapping before entitlement changes.
- Checkout and subscription fulfillment require exactly one approved line item/price before paid access can be granted.
- Async failures and subscription terminal/non-paying states fail closed, with only the explicit `past_due` grace window preserved.
- Portal sessions are created only for the authenticated user's own recurring customer and use a server-owned same-origin return URL.
- Reconciliation can compare Stripe with local state and repair by applying the same subscription projection RPC.

## Operational Logs

Structured route logs exist for:
- Checkout creation.
- Portal creation.
- Webhook receipt.
- Webhook processing.
- Entitlement projection results.
- Stripe/API errors through the shared route error handler.

Logs intentionally avoid secrets, full payment data, and raw personal/payment details. The durable Stripe event ledger stores a sanitized object summary rather than the full webhook payload.

## Runbooks

Webhook failure:
1. Find the Stripe event ID in `stripe_events`.
2. Inspect `status`, `processing_attempts`, `error_message`, `event_type`, and `object_id`.
3. Fix the root cause: config, price allowlist, customer mapping, Stripe API failure, or database error.
4. In Stripe Dashboard or Stripe CLI, replay the event after the fix.
5. Confirm `stripe_events.status='processed'` or `skipped` and the user's `account_entitlements` row is correct.

Replay an event:
1. Use Stripe Dashboard event replay or `stripe events resend`.
2. The handler will skip already processed events and retry failed events.
3. Never manually edit `profiles.subscription_status` as the first repair step.

Customer mapping issue:
1. Confirm the Supabase user ID.
2. Confirm the intended Stripe customer ID in Stripe.
3. Check `stripe_customer_mappings` and `profiles.stripe_customer_id`.
4. If a duplicate customer was created but no payments/subscriptions are attached, archive the duplicate in Stripe and keep one canonical mapping.
5. If paid objects exist on the wrong customer, decide whether to migrate billing in Stripe or create a privileged admin repair flow. Do not rely on metadata alone.

Entitlement bug:
1. Check `/konto` technical payment status for the local reason and last event.
2. Compare `account_entitlements`, `stripe_subscriptions`, and `stripe_checkout_sessions`.
3. Retrieve the Stripe Subscription or Checkout Session in Stripe.
4. Run dry reconciliation: `pnpm billing:reconcile`.
5. If the dry run identifies drift and Stripe is correct, run `pnpm billing:reconcile:repair`.

Reconciliation:
- Dry run: `pnpm billing:reconcile`
- Repair: `pnpm billing:reconcile:repair`
- Repair updates subscription-derived entitlement through `apply_subscription_projection`.
- One-time pass reconciliation is not yet automated; investigate Checkout Session and PaymentIntent history manually if a one-time pass is disputed.

## Verification

Automated coverage added or updated:
- Successful checkout grants entitlement only after verified webhook processing.
- Success/paid redirect state alone does not grant access; unpaid completion records no access.
- Duplicate webhook events do not reapply state.
- Out-of-order subscription events can be skipped by the database projection.
- Forged webhook signatures are rejected.
- Unknown/unapproved price IDs are rejected.
- Mismatched customer/session/user trace data is rejected.
- Failed/async payments do not grant access prematurely.
- `past_due` subscriptions remain active during the 7-day grace period and revoke when the grace period expires or no anchor exists.
- Canceled, unpaid, paused, incomplete, and incomplete-expired subscriptions revoke access.
- Portal route creates sessions only for the authenticated user's own recurring customer.
- Missing Stripe price config fails safely.
- Runtime display pricing rejects invalid local env values.
- Checkout, portal, cloud sync, and generation quota use `account_entitlements` instead of trusting stale profile projection fields.
- Webhook ledger persistence strips customer details from stored event payloads.

Commands run locally on April 28, 2026:
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec playwright test e2e/accessibility.spec.ts`

## Residual Risks And Human Decisions

- Stripe Customer Portal configuration must be kept aligned with approved product/price choices. If the portal allows switching to unapproved prices, webhooks will deny access for those subscriptions.
- Live Stripe test-mode end-to-end verification is still required after applying migrations.
- Reconciliation repair currently focuses on recurring subscriptions. One-time pass repair remains a manual support workflow.
- Supabase leaked-password protection remains a platform/plan decision outside this billing hardening pass.
