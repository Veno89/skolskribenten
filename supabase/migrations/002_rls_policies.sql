-- PROFILES: Users can only read/update their own row
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent users from self-upgrading subscription_status via client
    and subscription_status = (select subscription_status from public.profiles where id = auth.uid())
  );

-- USAGE_EVENTS: Users can only insert/read their own events
alter table public.usage_events enable row level security;

create policy "Users can insert own usage events"
  on public.usage_events for insert
  with check (auth.uid() = user_id);

create policy "Users can view own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);

-- Service role (used only by Stripe webhook server-side) can update subscription_status.
-- Enforced by using the service role key ONLY in the webhook handler.
