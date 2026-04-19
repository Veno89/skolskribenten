-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES table (extends Supabase auth.users)
-- IMPORTANT: We store ZERO pedagogical content here. Only account metadata.
create table public.profiles (
  id                          uuid references auth.users(id) on delete cascade primary key,
  email                       text not null,
  full_name                   text,
  school_name                 text,
  subscription_status         text not null default 'free'
                              check (subscription_status in ('free', 'pro', 'cancelled')),
  subscription_end_date       timestamptz,
  stripe_customer_id          text unique,
  transforms_used_this_month  integer not null default 0,
  transforms_reset_at         timestamptz not null default date_trunc('month', now()),
  -- api_call_count tracks requests per minute for server-side rate limiting (no Redis needed)
  api_call_count              integer not null default 0,
  api_call_window_start       timestamptz not null default now(),
  user_settings               jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Auto-create profile on signup
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- USAGE_EVENTS table (for audit trail - never stores any content)
-- Stores ONLY: who, when, which template type, and scrubber stats.
-- No input text. No output text. Ever.
create table public.usage_events (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade not null,
  template_type       text not null
                      check (template_type in ('incidentrapport', 'larlogg', 'veckobrev', 'custom')),
  scrubber_ran        boolean not null default true,
  pii_tokens_removed  integer not null default 0,
  created_at          timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
