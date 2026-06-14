-- Folio data table + Row-Level Security.
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- This guarantees a user can only ever read/write their OWN row.

create table if not exists public.folio (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Turn on RLS. With RLS enabled and no policy, all access is denied by default,
-- so the policies below are what grant each user access to their own row only.
alter table public.folio enable row level security;

-- Drop old policies if re-running, so this migration is idempotent.
drop policy if exists "folio_select_own" on public.folio;
drop policy if exists "folio_insert_own" on public.folio;
drop policy if exists "folio_update_own" on public.folio;
drop policy if exists "folio_delete_own" on public.folio;

create policy "folio_select_own"
  on public.folio for select
  using (auth.uid() = user_id);

create policy "folio_insert_own"
  on public.folio for insert
  with check (auth.uid() = user_id);

create policy "folio_update_own"
  on public.folio for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "folio_delete_own"
  on public.folio for delete
  using (auth.uid() = user_id);
