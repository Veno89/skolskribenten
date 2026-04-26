-- Make account_entitlements the explicit access source for paid gates and
-- make Stripe event processing recoverable if a worker dies mid-event.

insert into public.account_entitlements (
  user_id,
  access_level,
  source,
  reason,
  paid_access_until,
  last_transition_at
)
select
  p.id,
  case
    when p.subscription_status = 'pro'
      and (p.subscription_end_date is null or p.subscription_end_date > now())
      then 'pro'
    else 'free'
  end,
  case
    when p.subscription_status = 'pro' and p.subscription_end_date is null
      then 'recurring_subscription'
    when p.subscription_status = 'pro' and p.subscription_end_date > now()
      then 'one_time_pass'
    else 'none'
  end,
  case
    when p.subscription_status = 'pro' and p.subscription_end_date is null
      then 'legacy_profile_backfill_recurring'
    when p.subscription_status = 'pro' and p.subscription_end_date > now()
      then 'legacy_profile_backfill_one_time'
    when p.subscription_status = 'pro'
      then 'legacy_profile_backfill_expired'
    else 'no_paid_entitlement'
  end,
  case
    when p.subscription_status = 'pro' and p.subscription_end_date > now()
      then p.subscription_end_date
    else null
  end,
  now()
from public.profiles p
on conflict (user_id) do nothing;

update public.profiles
set
  subscription_status = 'cancelled',
  subscription_end_date = null
where
  subscription_status = 'pro'
  and subscription_end_date is not null
  and subscription_end_date <= now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, school_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'school_name'
  );

  insert into public.account_entitlements (
    user_id,
    access_level,
    source,
    reason
  )
  values (
    new.id,
    'free',
    'none',
    'no_paid_entitlement'
  )
  on conflict (user_id) do nothing;

  return new;
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
  v_processing_timeout interval := interval '5 minutes';
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

  if v_event.status in ('processed', 'skipped') then
    return query select false, v_event.status, v_event.processing_attempts;
    return;
  end if;

  if v_event.status = 'processing' and v_event.updated_at > now() - v_processing_timeout then
    return query select false, v_event.status, v_event.processing_attempts;
    return;
  end if;

  update public.stripe_events
  set
    status = 'processing',
    processing_attempts = processing_attempts + 1,
    error_message = null,
    payload = coalesce(p_payload, payload)
  where stripe_event_id = p_stripe_event_id
  returning * into v_event;

  return query select true, v_event.status, v_event.processing_attempts;
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
declare
  v_existing_session public.stripe_checkout_sessions%rowtype;
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

  if found and (
    v_existing_session.user_id <> p_user_id
    or v_existing_session.stripe_customer_id <> p_stripe_customer_id
    or v_existing_session.stripe_price_id <> p_stripe_price_id
    or v_existing_session.mode <> p_mode
  ) then
    raise exception 'checkout_session_identity_mismatch';
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

  if found and (
    v_existing_session.user_id <> p_user_id
    or v_existing_session.stripe_customer_id <> p_stripe_customer_id
    or v_existing_session.stripe_price_id <> p_stripe_price_id
    or v_existing_session.mode <> p_mode
  ) then
    raise exception 'checkout_session_identity_mismatch';
  end if;

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

  if found and (
    v_existing_subscription.user_id <> p_user_id
    or v_existing_subscription.stripe_customer_id <> p_stripe_customer_id
  ) then
    raise exception 'subscription_identity_mismatch';
  end if;

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
        stripe_checkout_session_id,
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
        null,
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

create or replace function public.begin_generation_attempt(
  p_user_id uuid,
  p_free_limit integer default 10,
  p_paid_limit integer default 100,
  p_window_seconds integer default 60,
  p_max_calls_per_window integer default 10
)
returns table (
  allowed boolean,
  reason text,
  reserved_transform boolean,
  subscription_status text,
  subscription_end_date timestamptz,
  transforms_used_this_month integer,
  user_settings jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_entitlement public.account_entitlements%rowtype;
  v_now timestamptz := now();
  v_is_pro boolean := false;
  v_transform_limit integer;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return query
    select
      false,
      'profile_not_found',
      false,
      null::text,
      null::timestamptz,
      null::integer,
      '{}'::jsonb;
    return;
  end if;

  select *
  into v_entitlement
  from public.account_entitlements
  where user_id = p_user_id
  for update;

  if not found then
    insert into public.account_entitlements (
      user_id,
      access_level,
      source,
      reason
    )
    values (
      p_user_id,
      'free',
      'none',
      'no_paid_entitlement'
    )
    on conflict (user_id) do nothing;

    select *
    into v_entitlement
    from public.account_entitlements
    where user_id = p_user_id
    for update;
  end if;

  v_is_pro := (
    v_entitlement.access_level = 'pro'
    and (
      v_entitlement.source = 'recurring_subscription'
      or (
        v_entitlement.source = 'admin'
        and (
          v_entitlement.paid_access_until is null
          or v_entitlement.paid_access_until > v_now
        )
      )
      or (
        v_entitlement.source = 'one_time_pass'
        and v_entitlement.paid_access_until is not null
        and v_entitlement.paid_access_until > v_now
      )
    )
  );

  if v_profile.api_call_window_start < v_now - make_interval(secs => greatest(p_window_seconds, 1)) then
    update public.profiles
    set
      api_call_count = 0,
      api_call_window_start = v_now
    where id = p_user_id
    returning * into v_profile;
  end if;

  if v_profile.api_call_count >= greatest(p_max_calls_per_window, 1) then
    return query
    select
      false,
      'rate_limited',
      false,
      v_profile.subscription_status,
      v_profile.subscription_end_date,
      v_profile.transforms_used_this_month,
      v_profile.user_settings;
    return;
  end if;

  update public.profiles
  set api_call_count = api_call_count + 1
  where id = p_user_id
  returning * into v_profile;

  v_transform_limit := case
    when v_is_pro then greatest(p_paid_limit, 0)
    else greatest(p_free_limit, 0)
  end;

  if v_profile.transforms_used_this_month >= v_transform_limit then
    return query
    select
      false,
      'quota_exceeded',
      false,
      v_profile.subscription_status,
      v_profile.subscription_end_date,
      v_profile.transforms_used_this_month,
      v_profile.user_settings;
    return;
  end if;

  update public.profiles
  set transforms_used_this_month = transforms_used_this_month + 1
  where id = p_user_id
  returning * into v_profile;

  return query
  select
    true,
    'allowed',
    true,
    v_profile.subscription_status,
    v_profile.subscription_end_date,
    v_profile.transforms_used_this_month,
    v_profile.user_settings;
end;
$$;
