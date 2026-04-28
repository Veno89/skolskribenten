-- Add a bounded recurring-subscription grace window for Stripe past_due states.

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

  if not found
    or v_entitlement.access_level <> 'pro'
    or (
      v_entitlement.source = 'recurring_subscription'
      and v_entitlement.paid_access_until is not null
      and v_entitlement.paid_access_until <= now()
    ) then
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

drop function if exists public.apply_subscription_projection(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  boolean,
  text,
  text,
  timestamptz,
  boolean,
  text,
  timestamptz
);

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
  p_reconciled_at timestamptz default null,
  p_paid_access_until timestamptz default null
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
      p_paid_access_until,
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
      paid_access_until = excluded.paid_access_until,
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

revoke all on function public.apply_subscription_projection(uuid, text, text, text, text, timestamptz, boolean, text, text, timestamptz, boolean, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_projection(uuid, text, text, text, text, timestamptz, boolean, text, text, timestamptz, boolean, text, timestamptz, timestamptz) to service_role;
