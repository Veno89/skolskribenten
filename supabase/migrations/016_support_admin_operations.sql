create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

comment on table public.app_admins is
  'Server-side allowlist for privileged app operations such as support triage. No direct client policies are granted.';

comment on table public.support_requests is
  'Durable support inbox. Access only through service-role server routes and admin-gated support tooling.';

create index if not exists support_requests_assigned_status_created_at_idx
  on public.support_requests (assigned_to, status, created_at desc);

grant all on public.app_admins to service_role;
grant all on public.support_requests to service_role;
