-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social — Comments: threaded replies + per-author reply privacy.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
--   • comments.parent_id: a comment can reply to another comment (one level).
--   • profiles.allow_replies: the author's privacy switch. When false, nobody
--     can post replies under that author's posts (top-level comments still work).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

alter table public.profiles
  add column if not exists allow_replies boolean not null default true;
