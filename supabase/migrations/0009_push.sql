-- ─────────────────────────────────────────────────────────────────────────────
-- Push notifications — the retention loop's "pull you back when the app is
-- closed" trigger. Stores Web Push subscriptions per device and tracks which
-- money events have already been pushed (separate from in-app seenEvents so the
-- two dedup independently).
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  endpoint   text primary key,                 -- unique per browser/device
  user_id    uuid not null references public.profiles (id) on delete cascade,
  keys       jsonb not null,                   -- { p256dh, auth } from PushSubscription
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_select on public.push_subscriptions;
drop policy if exists push_subs_insert on public.push_subscriptions;
drop policy if exists push_subs_delete on public.push_subscriptions;
-- Your subscriptions are yours. The notify edge function uses the service role,
-- which bypasses RLS, so it can read every subscription to send.
create policy push_subs_select on public.push_subscriptions for select using (auth.uid() = user_id);
create policy push_subs_insert on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy push_subs_delete on public.push_subscriptions for delete using (auth.uid() = user_id);

-- Which money-event keys we've already pushed to this user (server-side dedup).
alter table public.profiles add column if not exists pushed_events text[] not null default '{}';
