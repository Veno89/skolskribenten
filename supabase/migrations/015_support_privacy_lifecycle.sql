alter table public.support_requests
  add column if not exists request_id text,
  add column if not exists status text not null default 'new',
  add column if not exists assigned_to text,
  add column if not exists handled_at timestamptz,
  add column if not exists redacted_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists last_status_at timestamptz not null default now();

alter table public.support_requests
  drop constraint if exists support_requests_status_check;

alter table public.support_requests
  add constraint support_requests_status_check
  check (status in ('new', 'triaged', 'in_progress', 'resolved', 'spam', 'redacted', 'deleted'));

create index if not exists support_requests_status_created_at_idx
  on public.support_requests (status, created_at desc);

create index if not exists support_requests_request_id_idx
  on public.support_requests (request_id);

create or replace function public.set_support_request_last_status_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.last_status_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists support_requests_last_status_at on public.support_requests;

create trigger support_requests_last_status_at
before update on public.support_requests
for each row
execute function public.set_support_request_last_status_at();
