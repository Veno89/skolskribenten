create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'cancelled', 'approved', 'completed', 'rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id),
  handled_at timestamptz
);

create unique index if not exists account_deletion_requests_open_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'approved');

create index if not exists account_deletion_requests_status_requested_idx
  on public.account_deletion_requests (status, requested_at desc);

alter table public.account_deletion_requests enable row level security;

grant all on public.account_deletion_requests to service_role;

comment on table public.account_deletion_requests is
  'User-initiated account deletion requests. Access only through service-role server routes and admin-gated tooling.';

comment on column public.account_deletion_requests.reason is
  'Optional user-provided reason. Operators must treat as potentially sensitive free text.';

create or replace function public.touch_account_deletion_request_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_account_deletion_request_updated_at
  on public.account_deletion_requests;

create trigger touch_account_deletion_request_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.touch_account_deletion_request_updated_at();
