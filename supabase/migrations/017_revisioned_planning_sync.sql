alter table public.planning_checklists
  add column if not exists revision integer not null default 1,
  add column if not exists client_updated_at timestamptz;

update public.planning_checklists
set client_updated_at = coalesce(client_updated_at, updated_at)
where client_updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planning_checklists_revision_positive'
      and conrelid = 'public.planning_checklists'::regclass
  ) then
    alter table public.planning_checklists
      add constraint planning_checklists_revision_positive
      check (revision > 0);
  end if;
end $$;

create table if not exists public.planning_sync_conflicts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subject_id text not null,
  area_id text not null,
  server_revision integer not null,
  client_base_revision integer,
  server_updated_at timestamptz,
  client_updated_at timestamptz,
  server_progress_map jsonb not null default '{}'::jsonb,
  client_progress_map jsonb not null default '{}'::jsonb,
  server_teacher_notes_hash text not null,
  client_teacher_notes_hash text not null,
  server_teacher_notes_length integer not null default 0,
  client_teacher_notes_length integer not null default 0,
  resolved_at timestamptz,
  resolution_strategy text check (resolution_strategy in ('server', 'merged', 'local')),
  created_at timestamptz not null default now()
);

alter table public.planning_sync_conflicts enable row level security;

create policy "Users can view own planning sync conflicts"
  on public.planning_sync_conflicts for select
  using (auth.uid() = user_id);

create index if not exists planning_sync_conflicts_user_scope_created_at_idx
  on public.planning_sync_conflicts (user_id, subject_id, area_id, created_at desc);

create or replace function public.save_planning_checklist_revisioned(
  p_subject_id text,
  p_area_id text,
  p_progress_map jsonb,
  p_teacher_notes text,
  p_client_updated_at timestamptz,
  p_base_revision integer default null,
  p_resolved_conflict_id uuid default null,
  p_resolution_strategy text default null
)
returns table (
  applied boolean,
  conflict_id uuid,
  revision integer,
  updated_at timestamptz,
  client_updated_at timestamptz,
  progress_map jsonb,
  teacher_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_id uuid;
  v_existing public.planning_checklists%rowtype;
  v_now timestamptz := now();
  v_saved public.planning_checklists%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_resolution_strategy is not null and p_resolution_strategy not in ('server', 'merged', 'local') then
    raise exception 'Invalid planning conflict resolution strategy';
  end if;

  select *
  into v_existing
  from public.planning_checklists
  where user_id = v_user_id
    and subject_id = p_subject_id
    and area_id = p_area_id
  for update;

  if not found then
    begin
      insert into public.planning_checklists (
        user_id,
        subject_id,
        area_id,
        progress_map,
        teacher_notes,
        revision,
        client_updated_at,
        updated_at
      )
      values (
        v_user_id,
        p_subject_id,
        p_area_id,
        coalesce(p_progress_map, '{}'::jsonb),
        coalesce(p_teacher_notes, ''),
        1,
        p_client_updated_at,
        v_now
      )
      returning * into v_saved;

      if p_resolved_conflict_id is not null then
        update public.planning_sync_conflicts
        set resolved_at = v_now,
            resolution_strategy = p_resolution_strategy
        where id = p_resolved_conflict_id
          and user_id = v_user_id
          and resolved_at is null;
      end if;

      return query
      select
        true,
        null::uuid,
        v_saved.revision,
        v_saved.updated_at,
        v_saved.client_updated_at,
        v_saved.progress_map,
        v_saved.teacher_notes;
      return;
    exception when unique_violation then
      select *
      into v_existing
      from public.planning_checklists
      where user_id = v_user_id
        and subject_id = p_subject_id
        and area_id = p_area_id
      for update;
    end;
  end if;

  if p_base_revision is null or p_base_revision <> v_existing.revision then
    insert into public.planning_sync_conflicts (
      user_id,
      subject_id,
      area_id,
      server_revision,
      client_base_revision,
      server_updated_at,
      client_updated_at,
      server_progress_map,
      client_progress_map,
      server_teacher_notes_hash,
      client_teacher_notes_hash,
      server_teacher_notes_length,
      client_teacher_notes_length
    )
    values (
      v_user_id,
      p_subject_id,
      p_area_id,
      v_existing.revision,
      p_base_revision,
      v_existing.updated_at,
      p_client_updated_at,
      coalesce(v_existing.progress_map, '{}'::jsonb),
      coalesce(p_progress_map, '{}'::jsonb),
      md5(coalesce(v_existing.teacher_notes, '')),
      md5(coalesce(p_teacher_notes, '')),
      char_length(coalesce(v_existing.teacher_notes, '')),
      char_length(coalesce(p_teacher_notes, ''))
    )
    returning id into v_conflict_id;

    return query
    select
      false,
      v_conflict_id,
      v_existing.revision,
      v_existing.updated_at,
      v_existing.client_updated_at,
      v_existing.progress_map,
      v_existing.teacher_notes;
    return;
  end if;

  update public.planning_checklists
  set progress_map = coalesce(p_progress_map, '{}'::jsonb),
      teacher_notes = coalesce(p_teacher_notes, ''),
      client_updated_at = p_client_updated_at,
      updated_at = v_now,
      revision = revision + 1
  where id = v_existing.id
  returning * into v_saved;

  if p_resolved_conflict_id is not null then
    update public.planning_sync_conflicts
    set resolved_at = v_now,
        resolution_strategy = p_resolution_strategy
    where id = p_resolved_conflict_id
      and user_id = v_user_id
      and resolved_at is null;
  end if;

  return query
  select
    true,
    null::uuid,
    v_saved.revision,
    v_saved.updated_at,
    v_saved.client_updated_at,
    v_saved.progress_map,
    v_saved.teacher_notes;
end;
$$;

grant all on public.planning_sync_conflicts to service_role;
grant execute on function public.save_planning_checklist_revisioned(text, text, jsonb, text, timestamptz, integer, uuid, text)
  to authenticated;
