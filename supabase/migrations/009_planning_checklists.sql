create table if not exists public.planning_checklists (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject_id text not null,
  area_id text not null,
  progress_map jsonb not null default '{}'::jsonb,
  teacher_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planning_checklists_user_scope_unique unique (user_id, subject_id, area_id)
);

alter table public.planning_checklists enable row level security;

create policy "Users can view own planning checklists"
  on public.planning_checklists for select
  using (auth.uid() = user_id);

create policy "Users can insert own planning checklists"
  on public.planning_checklists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own planning checklists"
  on public.planning_checklists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own planning checklists"
  on public.planning_checklists for delete
  using (auth.uid() = user_id);

create trigger planning_checklists_updated_at
  before update on public.planning_checklists
  for each row execute function public.set_updated_at();
