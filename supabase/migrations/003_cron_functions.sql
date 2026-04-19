-- Reset monthly transform count on the 1st of each month
create or replace function public.reset_monthly_transforms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    transforms_used_this_month = 0,
    transforms_reset_at = date_trunc('month', now())
  where
    transforms_reset_at < date_trunc('month', now());
end;
$$;

-- Schedule via Supabase Dashboard > Database > Extensions > pg_cron:
-- select cron.schedule('reset-monthly-transforms', '0 0 1 * *', 'select public.reset_monthly_transforms()');

-- Expire 30-day passes when their end date passes
create or replace function public.expire_one_time_passes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set subscription_status = 'cancelled'
  where
    subscription_status = 'pro'
    and subscription_end_date is not null
    and subscription_end_date < now();
end;
$$;

-- Schedule daily at midnight:
-- select cron.schedule('expire-one-time-passes', '0 0 * * *', 'select public.expire_one_time_passes()');
