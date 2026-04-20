create table if not exists public.support_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  role text,
  topic text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_requests_created_at_idx
  on public.support_requests (created_at desc);

create index if not exists support_requests_user_id_idx
  on public.support_requests (user_id);

alter table public.support_requests enable row level security;
