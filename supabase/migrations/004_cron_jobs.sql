create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'reset-monthly-transforms'
  ) then
    perform cron.schedule(
      'reset-monthly-transforms',
      '0 0 1 * *',
      'select public.reset_monthly_transforms();'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'expire-one-time-passes'
  ) then
    perform cron.schedule(
      'expire-one-time-passes',
      '0 0 * * *',
      'select public.expire_one_time_passes();'
    );
  end if;
end
$$;
