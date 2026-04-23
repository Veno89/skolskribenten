alter table public.usage_events
  drop constraint if exists usage_events_template_type_check;

alter table public.usage_events
  add constraint usage_events_template_type_check
  check (template_type in ('incidentrapport', 'larlogg', 'unikum', 'veckobrev', 'custom', 'lektionsplanering'));
