alter table public.usage_events
  add column if not exists ai_provider text not null default 'anthropic',
  add column if not exists ai_model text not null default 'unknown',
  add column if not exists prompt_version text not null default 'unknown',
  add column if not exists output_guard_version text not null default 'unknown',
  add column if not exists output_guard_passed boolean not null default true,
  add column if not exists output_guard_warnings text[] not null default '{}'::text[];

comment on column public.usage_events.ai_provider is
  'AI provider identifier. Metadata only; never stores prompt or generated content.';

comment on column public.usage_events.ai_model is
  'AI model identifier used for generation. Metadata only; never stores prompt or generated content.';

comment on column public.usage_events.prompt_version is
  'Application prompt contract version used for generation. Metadata only.';

comment on column public.usage_events.output_guard_version is
  'Application output guard version used for post-generation validation. Metadata only.';

comment on column public.usage_events.output_guard_passed is
  'Whether the post-generation output guard allowed the response to be returned.';

comment on column public.usage_events.output_guard_warnings is
  'Non-blocking output guard warning labels/messages. Must not contain raw input or generated text.';

create index if not exists usage_events_ai_metadata_created_at_idx
  on public.usage_events (prompt_version, ai_model, created_at desc);

create index if not exists usage_events_output_guard_created_at_idx
  on public.usage_events (output_guard_passed, created_at desc);
