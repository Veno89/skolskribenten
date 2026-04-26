-- Harden Stripe billing state projection.
-- Stripe remains the source of truth. These tables are our durable,
-- idempotent local projection plus account entitlement state.

create table if not exists public.stripe_customer_mappings (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id  text not null unique,
  livemode            boolean not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.stripe_checkout_sessions (
  id                          uuid default uuid_generate_v4() primary key,
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id          text not null,
  stripe_checkout_session_id  text not null unique,
  stripe_subscription_id      text,
  stripe_payment_intent_id    text,
  price_key                   text not null,
  stripe_price_id             text not null,
  mode                        text not null check (mode in ('payment', 'subscription')),
  status                      text,
  payment_status              text,
  livemode                    boolean not null,
  latest_event_id             text,
  latest_event_created_at     timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_id, stripe_checkout_session_id)
);

create table if not exists public.stripe_subscriptions (
  id                       uuid default uuid_generate_v4() primary key,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id       text not null,
  stripe_subscription_id   text not null unique,
  stripe_price_id          text,
  stripe_status            text not null check (
    stripe_status in (
      'trialing',
      'active',
      'past_due',
      'unpaid',
      'canceled',
      'paused',
      'incomplete',
      'incomplete_expired'
    )
  ),
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  latest_invoice_id        text,
  latest_event_id          text,
  latest_event_created_at  timestamptz,
  last_reconciled_at       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, stripe_subscription_id)
);

create table if not exists public.account_entitlements (
  user_id                     uuid primary key references public.profiles(id) on delete cascade,
  access_level                text not null default 'free' check (access_level in ('free', 'pro')),
  source                      text not null default 'none'
                              check (source in ('none', 'recurring_subscription', 'one_time_pass', 'admin')),
  reason                      text not null default 'no_paid_entitlement',
  paid_access_until           timestamptz,
  stripe_subscription_id      text,
  stripe_checkout_session_id  text,
  last_stripe_event_id        text,
  last_transition_at          timestamptz not null default now(),
  last_reconciled_at          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists public.stripe_events (
  stripe_event_id       text primary key,
  event_type            text not null,
  object_id             text,
  stripe_created_at     timestamptz not null,
  livemode              boolean not null,
  status                text not null default 'received'
                        check (status in ('received', 'processing', 'processed', 'failed', 'skipped')),
  processing_attempts   integer not null default 0,
  error_message         text,
  payload               jsonb not null default '{}'::jsonb,
  processed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (processing_attempts >= 0)
);

create index if not exists stripe_events_type_object_idx
  on public.stripe_events (event_type, object_id);

create index if not exists stripe_checkout_sessions_user_idx
  on public.stripe_checkout_sessions (user_id, created_at desc);

create index if not exists stripe_subscriptions_user_idx
  on public.stripe_subscriptions (user_id, updated_at desc);

create trigger stripe_customer_mappings_updated_at
  before update on public.stripe_customer_mappings
  for each row execute function public.set_updated_at();

create trigger stripe_checkout_sessions_updated_at
  before update on public.stripe_checkout_sessions
  for each row execute function public.set_updated_at();

create trigger stripe_subscriptions_updated_at
  before update on public.stripe_subscriptions
  for each row execute function public.set_updated_at();

create trigger account_entitlements_updated_at
  before update on public.account_entitlements
  for each row execute function public.set_updated_at();

create trigger stripe_events_updated_at
  before update on public.stripe_events
  for each row execute function public.set_updated_at();

alter table public.stripe_customer_mappings enable row level security;
alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.account_entitlements enable row level security;
alter table public.stripe_events enable row level security;

create policy "Users can view own Stripe customer mapping"
  on public.stripe_customer_mappings for select
  using (auth.uid() = user_id);

create policy "Users can view own checkout sessions"
  on public.stripe_checkout_sessions for select
  using (auth.uid() = user_id);

create policy "Users can view own Stripe subscriptions"
  on public.stripe_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can view own account entitlement"
  on public.account_entitlements for select
  using (auth.uid() = user_id);

create or replace function public.sync_profile_from_entitlement(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entitlement public.account_entitlements%rowtype;
begin
  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id;

  if not found or v_entitlement.access_level <> 'pro' then
    update public.profiles
    set
      subscription_status = 'cancelled',
      subscription_end_date = null
    where id = p_user_id;
    return;
  end if;

  update public.profiles
  set
    subscription_status = 'pro',
    subscription_end_date = case
      when v_entitlement.source = 'one_time_pass' then v_entitlement.paid_access_until
      else null
    end
  where id = p_user_id;
end;
$$;

create or replace function public.record_stripe_customer_mapping(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_livemode boolean
)
returns table (
  user_id uuid,
  stripe_customer_id text,
  livemode boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_existing public.stripe_customer_mappings%rowtype;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_existing
  from public.stripe_customer_mappings
  where stripe_customer_id = p_stripe_customer_id
  for update;

  if found and v_existing.user_id <> p_user_id then
    raise exception 'stripe_customer_already_mapped';
  end if;

  if v_profile.stripe_customer_id is not null and v_profile.stripe_customer_id <> p_stripe_customer_id then
    raise exception 'profile_has_different_stripe_customer';
  end if;

  insert into public.stripe_customer_mappings (
    user_id,
    stripe_customer_id,
    livemode
  )
  values (
    p_user_id,
    p_stripe_customer_id,
    p_livemode
  )
  on conflict (user_id) do update
  set
    stripe_customer_id = excluded.stripe_customer_id,
    livemode = excluded.livemode
  where public.stripe_customer_mappings.stripe_customer_id = excluded.stripe_customer_id;

  if not found then
    raise exception 'user_has_different_stripe_customer';
  end if;

  update public.profiles
  set stripe_customer_id = p_stripe_customer_id
  where id = p_user_id;

  return query
  select
    scm.user_id,
    scm.stripe_customer_id,
    scm.livemode
  from public.stripe_customer_mappings scm
  where scm.user_id = p_user_id;
end;
$$;

create or replace function public.claim_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_object_id text,
  p_stripe_created_at timestamptz,
  p_livemode boolean,
  p_payload jsonb
)
returns table (
  should_process boolean,
  status text,
  processing_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.stripe_events%rowtype;
begin
  insert into public.stripe_events (
    stripe_event_id,
    event_type,
    object_id,
    stripe_created_at,
    livemode,
    status,
    processing_attempts,
    payload
  )
  values (
    p_stripe_event_id,
    p_event_type,
    p_object_id,
    p_stripe_created_at,
    p_livemode,
    'processing',
    1,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (stripe_event_id) do nothing
  returning * into v_event;

  if found then
    return query select true, v_event.status, v_event.processing_attempts;
    return;
  end if;

  select *
  into v_event
  from public.stripe_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if v_event.status in ('processed', 'skipped', 'processing') then
    return query select false, v_event.status, v_event.processing_attempts;
    return;
  end if;

  update public.stripe_events
  set
    status = 'processing',
    processing_attempts = processing_attempts + 1,
    error_message = null
  where stripe_event_id = p_stripe_event_id
  returning * into v_event;

  return query select true, v_event.status, v_event.processing_attempts;
end;
$$;

create or replace function public.complete_stripe_event(
  p_stripe_event_id text,
  p_status text,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('processed', 'failed', 'skipped') then
    raise exception 'invalid_stripe_event_status';
  end if;

  update public.stripe_events
  set
    status = p_status,
    error_message = left(p_error_message, 2000),
    processed_at = case when p_status in ('processed', 'skipped') then now() else processed_at end
  where stripe_event_id = p_stripe_event_id;
end;
$$;

create or replace function public.record_checkout_session_created(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_checkout_session_id text,
  p_price_key text,
  p_stripe_price_id text,
  p_mode text,
  p_status text,
  p_payment_status text,
  p_livemode boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  insert into public.stripe_checkout_sessions (
    user_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    price_key,
    stripe_price_id,
    mode,
    status,
    payment_status,
    livemode
  )
  values (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_checkout_session_id,
    p_price_key,
    p_stripe_price_id,
    p_mode,
    p_status,
    p_payment_status,
    p_livemode
  )
  on conflict (stripe_checkout_session_id) do update
  set
    status = excluded.status,
    payment_status = excluded.payment_status;
end;
$$;

create or replace function public.apply_checkout_session_projection(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_checkout_session_id text,
  p_price_key text,
  p_stripe_price_id text,
  p_mode text,
  p_status text,
  p_payment_status text,
  p_livemode boolean,
  p_access_until timestamptz,
  p_stripe_subscription_id text,
  p_stripe_payment_intent_id text,
  p_event_id text,
  p_event_created_at timestamptz
)
returns table (
  applied boolean,
  entitlement_access_level text,
  entitlement_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_session public.stripe_checkout_sessions%rowtype;
  v_entitlement public.account_entitlements%rowtype;
begin
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_existing_session
  from public.stripe_checkout_sessions
  where stripe_checkout_session_id = p_stripe_checkout_session_id
  for update;

  if found
    and v_existing_session.latest_event_created_at is not null
    and p_event_created_at < v_existing_session.latest_event_created_at then
    select *
    into v_entitlement
    from public.account_entitlements
    where user_id = p_user_id;

    return query
    select
      false,
      coalesce(v_entitlement.access_level, 'free'),
      coalesce(v_entitlement.reason, 'out_of_order_checkout_event_skipped');
    return;
  end if;

  insert into public.stripe_checkout_sessions (
    user_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    price_key,
    stripe_price_id,
    mode,
    status,
    payment_status,
    livemode,
    stripe_subscription_id,
    stripe_payment_intent_id,
    latest_event_id,
    latest_event_created_at
  )
  values (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_checkout_session_id,
    p_price_key,
    p_stripe_price_id,
    p_mode,
    p_status,
    p_payment_status,
    p_livemode,
    p_stripe_subscription_id,
    p_stripe_payment_intent_id,
    p_event_id,
    p_event_created_at
  )
  on conflict (stripe_checkout_session_id) do update
  set
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    status = excluded.status,
    payment_status = excluded.payment_status,
    latest_event_id = excluded.latest_event_id,
    latest_event_created_at = excluded.latest_event_created_at;

  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id
  for update;

  if p_access_until is not null and p_access_until > now() then
    if not found
      or v_entitlement.access_level <> 'pro'
      or v_entitlement.source <> 'recurring_subscription' then
      insert into public.account_entitlements (
        user_id,
        access_level,
        source,
        reason,
        paid_access_until,
        stripe_checkout_session_id,
        last_stripe_event_id,
        last_transition_at
      )
      values (
        p_user_id,
        'pro',
        'one_time_pass',
        'one_time_checkout_paid',
        p_access_until,
        p_stripe_checkout_session_id,
        p_event_id,
        now()
      )
      on conflict (user_id) do update
      set
        access_level = 'pro',
        source = 'one_time_pass',
        reason = 'one_time_checkout_paid',
        paid_access_until = greatest(
          excluded.paid_access_until,
          coalesce(public.account_entitlements.paid_access_until, excluded.paid_access_until)
        ),
        stripe_checkout_session_id = excluded.stripe_checkout_session_id,
        last_stripe_event_id = excluded.last_stripe_event_id,
        last_transition_at = now();
    end if;
  end if;

  perform public.sync_profile_from_entitlement(p_user_id);

  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id;

  return query
  select
    true,
    coalesce(v_entitlement.access_level, 'free'),
    coalesce(v_entitlement.reason, 'checkout_recorded_without_entitlement');
end;
$$;

create or replace function public.apply_subscription_projection(
  p_user_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_stripe_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_latest_invoice_id text,
  p_event_id text,
  p_event_created_at timestamptz,
  p_entitlement_active boolean,
  p_entitlement_reason text,
  p_reconciled_at timestamptz default null
)
returns table (
  applied boolean,
  entitlement_access_level text,
  entitlement_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_subscription public.stripe_subscriptions%rowtype;
  v_entitlement public.account_entitlements%rowtype;
begin
  perform 1
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_existing_subscription
  from public.stripe_subscriptions
  where stripe_subscription_id = p_stripe_subscription_id
  for update;

  if found
    and v_existing_subscription.latest_event_created_at is not null
    and p_event_created_at < v_existing_subscription.latest_event_created_at then
    select *
    into v_entitlement
    from public.account_entitlements
    where user_id = p_user_id;

    return query
    select
      false,
      coalesce(v_entitlement.access_level, 'free'),
      coalesce(v_entitlement.reason, 'out_of_order_subscription_event_skipped');
    return;
  end if;

  insert into public.stripe_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    stripe_status,
    current_period_end,
    cancel_at_period_end,
    latest_invoice_id,
    latest_event_id,
    latest_event_created_at,
    last_reconciled_at
  )
  values (
    p_user_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_stripe_status,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false),
    p_latest_invoice_id,
    p_event_id,
    p_event_created_at,
    p_reconciled_at
  )
  on conflict (stripe_subscription_id) do update
  set
    stripe_price_id = excluded.stripe_price_id,
    stripe_status = excluded.stripe_status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    latest_invoice_id = excluded.latest_invoice_id,
    latest_event_id = excluded.latest_event_id,
    latest_event_created_at = excluded.latest_event_created_at,
    last_reconciled_at = coalesce(excluded.last_reconciled_at, public.stripe_subscriptions.last_reconciled_at);

  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id
  for update;

  if p_entitlement_active then
    insert into public.account_entitlements (
      user_id,
      access_level,
      source,
      reason,
      paid_access_until,
      stripe_subscription_id,
      stripe_checkout_session_id,
      last_stripe_event_id,
      last_transition_at,
      last_reconciled_at
    )
    values (
      p_user_id,
      'pro',
      'recurring_subscription',
      p_entitlement_reason,
      null,
      p_stripe_subscription_id,
      null,
      p_event_id,
      now(),
      p_reconciled_at
    )
    on conflict (user_id) do update
    set
      access_level = 'pro',
      source = 'recurring_subscription',
      reason = excluded.reason,
      paid_access_until = null,
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_checkout_session_id = null,
      last_stripe_event_id = excluded.last_stripe_event_id,
      last_transition_at = now(),
      last_reconciled_at = coalesce(excluded.last_reconciled_at, public.account_entitlements.last_reconciled_at);
  else
    if not found
      or v_entitlement.source = 'recurring_subscription'
      or v_entitlement.paid_access_until is null
      or v_entitlement.paid_access_until <= now() then
      insert into public.account_entitlements (
        user_id,
        access_level,
        source,
        reason,
        paid_access_until,
        stripe_subscription_id,
        last_stripe_event_id,
        last_transition_at,
        last_reconciled_at
      )
      values (
        p_user_id,
        'free',
        'none',
        p_entitlement_reason,
        null,
        p_stripe_subscription_id,
        p_event_id,
        now(),
        p_reconciled_at
      )
      on conflict (user_id) do update
      set
        access_level = 'free',
        source = 'none',
        reason = excluded.reason,
        paid_access_until = null,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_checkout_session_id = null,
        last_stripe_event_id = excluded.last_stripe_event_id,
        last_transition_at = now(),
        last_reconciled_at = coalesce(excluded.last_reconciled_at, public.account_entitlements.last_reconciled_at);
    end if;
  end if;

  perform public.sync_profile_from_entitlement(p_user_id);

  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id;

  return query
  select
    true,
    coalesce(v_entitlement.access_level, 'free'),
    coalesce(v_entitlement.reason, p_entitlement_reason);
end;
$$;

create or replace function public.expire_one_time_passes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    update public.account_entitlements
    set
      access_level = 'free',
      source = 'none',
      reason = 'one_time_pass_expired',
      paid_access_until = null,
      stripe_checkout_session_id = null,
      last_transition_at = now()
    where
      access_level = 'pro'
      and source = 'one_time_pass'
      and paid_access_until is not null
      and paid_access_until < now()
    returning user_id
  loop
    perform public.sync_profile_from_entitlement(v_row.user_id);
  end loop;

  -- Backward-compatible cleanup for any legacy rows that predate account_entitlements.
  update public.profiles
  set subscription_status = 'cancelled'
  where
    subscription_status = 'pro'
    and subscription_end_date is not null
    and subscription_end_date < now();
end;
$$;

revoke all on table public.stripe_customer_mappings from public, anon, authenticated;
revoke all on table public.stripe_checkout_sessions from public, anon, authenticated;
revoke all on table public.stripe_subscriptions from public, anon, authenticated;
revoke all on table public.account_entitlements from public, anon, authenticated;
revoke all on table public.stripe_events from public, anon, authenticated;

grant select on public.stripe_customer_mappings to authenticated;
grant select on public.stripe_checkout_sessions to authenticated;
grant select on public.stripe_subscriptions to authenticated;
grant select on public.account_entitlements to authenticated;

grant all on public.stripe_customer_mappings to service_role;
grant all on public.stripe_checkout_sessions to service_role;
grant all on public.stripe_subscriptions to service_role;
grant all on public.account_entitlements to service_role;
grant all on public.stripe_events to service_role;

revoke all on function public.sync_profile_from_entitlement(uuid) from public, anon, authenticated;
revoke all on function public.record_stripe_customer_mapping(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_stripe_event(text, text, text, timestamptz, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text, text, text) from public, anon, authenticated;
revoke all on function public.record_checkout_session_created(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.apply_checkout_session_projection(uuid, text, text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_subscription_projection(uuid, text, text, text, text, timestamptz, boolean, text, text, timestamptz, boolean, text, timestamptz) from public, anon, authenticated;

grant execute on function public.sync_profile_from_entitlement(uuid) to service_role;
grant execute on function public.record_stripe_customer_mapping(uuid, text, boolean) to service_role;
grant execute on function public.claim_stripe_event(text, text, text, timestamptz, boolean, jsonb) to service_role;
grant execute on function public.complete_stripe_event(text, text, text) to service_role;
grant execute on function public.record_checkout_session_created(uuid, text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.apply_checkout_session_projection(uuid, text, text, text, text, text, text, text, boolean, timestamptz, text, text, text, timestamptz) to service_role;
grant execute on function public.apply_subscription_projection(uuid, text, text, text, text, timestamptz, boolean, text, text, timestamptz, boolean, text, timestamptz) to service_role;
