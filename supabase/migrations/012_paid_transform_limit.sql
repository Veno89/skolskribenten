drop function if exists public.begin_generation_attempt(uuid, integer, integer, integer);

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
  v_now timestamptz := now();
  v_is_pro boolean;
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

  v_is_pro := (
    v_profile.subscription_status = 'pro'
    and (
      v_profile.subscription_end_date is null
      or v_profile.subscription_end_date > v_now
    )
  );
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

revoke all on function public.begin_generation_attempt(uuid, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.begin_generation_attempt(uuid, integer, integer, integer, integer) to service_role;
