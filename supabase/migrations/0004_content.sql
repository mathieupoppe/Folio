-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social — Content controls: Archive + Recently deleted (soft delete).
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
--   • archived_at: post is hidden from the profile grid + feed but kept (like
--     Instagram's Archive). Owner can un-archive any time.
--   • deleted_at:  soft delete. Post is hidden everywhere and shown only under
--     "Recently deleted" for 30 days, then purged for good.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.posts add column if not exists archived_at timestamptz;
alter table public.posts add column if not exists deleted_at  timestamptz;

-- Feeds/grids read active posts a lot — index the common filter.
create index if not exists posts_active_idx
  on public.posts (author_id, created_at desc)
  where archived_at is null and deleted_at is null;
