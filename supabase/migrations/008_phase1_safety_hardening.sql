alter table public.usage_events
  add column if not exists client_reported_pii_tokens_removed integer not null default 0;

alter table public.usage_events
  add column if not exists server_pii_check_passed boolean not null default true;

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and email = (select email from public.profiles where id = auth.uid())
    and subscription_status = (select subscription_status from public.profiles where id = auth.uid())
    and subscription_end_date is not distinct from (
      select subscription_end_date from public.profiles where id = auth.uid()
    )
    and stripe_customer_id is not distinct from (
      select stripe_customer_id from public.profiles where id = auth.uid()
    )
    and transforms_used_this_month = (
      select transforms_used_this_month from public.profiles where id = auth.uid()
    )
    and transforms_reset_at = (select transforms_reset_at from public.profiles where id = auth.uid())
    and api_call_count = (select api_call_count from public.profiles where id = auth.uid())
    and api_call_window_start = (
      select api_call_window_start from public.profiles where id = auth.uid()
    )
    and created_at = (select created_at from public.profiles where id = auth.uid())
  );

create or replace function public.begin_generation_attempt(
  p_user_id uuid,
  p_free_limit integer default 10,
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

  if not v_is_pro then
    if v_profile.transforms_used_this_month >= greatest(p_free_limit, 0) then
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
    return;
  end if;

  return query
  select
    true,
    'allowed',
    false,
    v_profile.subscription_status,
    v_profile.subscription_end_date,
    v_profile.transforms_used_this_month,
    v_profile.user_settings;
end;
$$;

create or replace function public.release_generation_attempt(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set transforms_used_this_month = greatest(transforms_used_this_month - 1, 0)
  where id = p_user_id;
end;
$$;

revoke all on function public.begin_generation_attempt(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.begin_generation_attempt(uuid, integer, integer, integer) to service_role;

revoke all on function public.release_generation_attempt(uuid) from public, anon, authenticated;
grant execute on function public.release_generation_attempt(uuid) to service_role;
