-- User feedback: bug reports + feature/tool suggestions.
-- Run in the Supabase SQL editor (or via `supabase db push`).
-- Users can submit and see their own feedback; the project owner reads all
-- rows from the Supabase dashboard (service role bypasses RLS).

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null check (kind in ('bug', 'idea')),
  message    text not null check (char_length(message) between 1 and 4000),
  contact    text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
drop policy if exists "feedback_select_own" on public.feedback;

-- A signed-in user may submit feedback as themselves.
create policy "feedback_insert_own"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- A user can read back only their own submissions.
create policy "feedback_select_own"
  on public.feedback for select
  using (auth.uid() = user_id);
