-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social — Direct messages (1:1 chat). Send text and share posts.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- A message has a sender + recipient. It carries text, a shared post, or both.
-- Conversations are derived from messages between two people (no separate table
-- needed for 1:1). RLS: you only see messages you're part of; you can only send
-- as yourself, and only the recipient can mark a message read.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text,
  post_id      uuid references public.posts (id) on delete set null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint message_not_empty check (body is not null or post_id is not null),
  constraint no_self_message check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at desc);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_update on public.messages;

-- You can read any message you sent or received.
create policy messages_select on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- You can only send messages as yourself.
create policy messages_insert on public.messages for insert
  with check (auth.uid() = sender_id);

-- Only the recipient can update (used to set read_at).
create policy messages_update on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
