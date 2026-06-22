-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social — Phase 4: moderation. The minimum a social app needs to pass
-- app-store review: users can REPORT content/people, BLOCK people, and there's a
-- manual admin REVIEW QUEUE. Terms of Service acceptance is tracked per user.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- Security model:
--   • reports: a user can file a report and see their OWN reports. Admins (an
--     is_admin flag on profiles) can read & resolve every report.
--   • blocks: fully private — you can only see and manage your own block list.
--   • Blocking is enforced CLIENT-side (filter feed/search). Posts stay public
--     in the DB; we just hide blocked authors from the blocker.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profile flags: admin + ToS acceptance ───────────────────────────────────
alter table public.profiles add column if not exists is_admin        boolean    not null default false;
alter table public.profiles add column if not exists tos_accepted_at timestamptz;

-- Admin check usable inside RLS policies (security definer dodges recursion).
create or replace function public.is_app_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- Privilege-escalation guard: the existing profiles_update RLS policy lets a user
-- edit their own row, which would otherwise let anyone self-set is_admin=true.
-- This trigger blocks a client (non-superuser) from changing is_admin; only the
-- SQL editor / service role (which run as table owner / bypass triggers via
-- session_replication_role) can grant admin.
create or replace function public.guard_is_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null for the service role / SQL editor (table owner) — allow those.
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'is_admin can only be changed by an administrator';
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_is_admin on public.profiles;
create trigger trg_guard_is_admin before update on public.profiles
  for each row execute function public.guard_is_admin();

-- ── blocks ───────────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);

alter table public.blocks enable row level security;
drop policy if exists blocks_select on public.blocks;
drop policy if exists blocks_insert on public.blocks;
drop policy if exists blocks_delete on public.blocks;
-- Your block list is yours alone — not even the blocked person can see it.
create policy blocks_select on public.blocks for select using (auth.uid() = blocker_id);
create policy blocks_insert on public.blocks for insert with check (auth.uid() = blocker_id);
create policy blocks_delete on public.blocks for delete using (auth.uid() = blocker_id);

-- ── reports ──────────────────────────────────────────────────────────────────
-- A report targets a post OR a user (exactly one). status walks the review queue.
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  target_post_id  uuid references public.posts (id) on delete cascade,
  target_user_id  uuid references public.profiles (id) on delete set null,
  reason          text not null,                 -- spam | harassment | scam | nudity | misinfo | other
  details         text not null default '',
  status          text not null default 'open',  -- open | reviewing | resolved | dismissed
  action_taken    text,                          -- free-text note from the reviewer
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  constraint report_one_target check (
    (target_post_id is not null)::int + (target_user_id is not null)::int = 1
  ),
  constraint report_status_valid check (status in ('open','reviewing','resolved','dismissed')),
  constraint report_no_self check (target_user_id is null or target_user_id <> reporter_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;
drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert on public.reports;
drop policy if exists reports_update on public.reports;
-- You can read your own filings; admins read everything.
create policy reports_select on public.reports for select
  using (auth.uid() = reporter_id or public.is_app_admin());
-- You can only file a report as yourself.
create policy reports_insert on public.reports for insert
  with check (auth.uid() = reporter_id);
-- Only admins can move a report through the queue.
create policy reports_update on public.reports for update
  using (public.is_app_admin()) with check (public.is_app_admin());
