-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social backend — Phase 1: profiles, posts, follows, likes, comments.
-- "Instagram for finance" v1 (photos + text only; no video yet).
-- Run in the Supabase SQL editor or via `supabase db push`.
--
-- Security model:
--   • Everything is PUBLICLY READABLE (it's a social feed) — select policies use
--     `true`. Personal finance data stays in the separate private `folio` table.
--   • Writes are restricted to the owning user via RLS.
--   • Denormalized counts (followers/following/posts/likes/comments) are kept
--     accurate by triggers, so the feed never has to COUNT() on every read.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
-- One row per user, mirrors auth.users. Public identity for the social side.
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  handle          text not null,
  display_name    text not null default '',
  bio             text not null default '',
  avatar_url      text,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count     integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Case-insensitive unique handle (so @Finn and @finn can't both exist).
create unique index if not exists profiles_handle_lower_idx on public.profiles (lower(handle));
-- Handles: 3–20 chars, letters/numbers/underscore/dot only.
alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format
  check (handle ~ '^[A-Za-z0-9_.]{3,20}$');

-- ── posts ───────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  caption       text not null default '',
  image_url     text,                       -- Supabase Storage public URL (Phase 2)
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  -- a post must have at least a caption or an image
  constraint posts_not_empty check (length(trim(caption)) > 0 or image_url is not null)
);
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);

-- ── follows ─────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- ── likes ───────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists likes_post_idx on public.likes (post_id);

-- ── comments ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.follows  enable row level security;
alter table public.likes    enable row level security;
alter table public.comments enable row level security;

-- profiles: anyone can read; you can only insert/update YOUR own row.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- posts: public read; author-only write/delete.
drop policy if exists posts_select on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_update on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_select on public.posts for select using (true);
create policy posts_insert on public.posts for insert with check (auth.uid() = author_id);
create policy posts_update on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy posts_delete on public.posts for delete using (auth.uid() = author_id);

-- follows: public read; you can only create/remove follows where YOU are the follower.
drop policy if exists follows_select on public.follows;
drop policy if exists follows_insert on public.follows;
drop policy if exists follows_delete on public.follows;
create policy follows_select on public.follows for select using (true);
create policy follows_insert on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

-- likes: public read; you can only like/unlike as yourself.
drop policy if exists likes_select on public.likes;
drop policy if exists likes_insert on public.likes;
drop policy if exists likes_delete on public.likes;
create policy likes_select on public.likes for select using (true);
create policy likes_insert on public.likes for insert with check (auth.uid() = user_id);
create policy likes_delete on public.likes for delete using (auth.uid() = user_id);

-- comments: public read; author-only create/delete.
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_select on public.comments for select using (true);
create policy comments_insert on public.comments for insert with check (auth.uid() = author_id);
create policy comments_delete on public.comments for delete using (auth.uid() = author_id);

-- ── Auto-create a profile when a new auth user signs up ───────────────────────
-- Derives a starting handle from the email local-part, sanitized + made unique.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base   text;
  cand   text;
  n      integer := 0;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'user'), '@', 1), '[^a-z0-9_.]', '', 'g'));
  if length(base) < 3 then base := 'user' || base; end if;
  base := left(base, 16);
  cand := base;
  while exists (select 1 from public.profiles where lower(handle) = lower(cand)) loop
    n := n + 1;
    cand := left(base, 14) || n::text;
  end loop;
  insert into public.profiles (id, handle, display_name)
  values (new.id, cand, '')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Count-maintaining triggers ────────────────────────────────────────────────
-- posts_count on profiles
create or replace function public.bump_posts_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set posts_count = greatest(0, posts_count - 1) where id = old.author_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_posts_count on public.posts;
create trigger trg_posts_count after insert or delete on public.posts
  for each row execute function public.bump_posts_count();

-- follower/following counts on profiles
create or replace function public.bump_follow_counts() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update public.profiles set followers_count = greatest(0, followers_count - 1) where id = old.followee_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_follow_counts on public.follows;
create trigger trg_follow_counts after insert or delete on public.follows
  for each row execute function public.bump_follow_counts();

-- like_count on posts
create or replace function public.bump_like_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_like_count on public.likes;
create trigger trg_like_count after insert or delete on public.likes
  for each row execute function public.bump_like_count();

-- comment_count on posts
create or replace function public.bump_comment_count() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

-- ── Backfill profiles for users who signed up BEFORE this migration ───────────
insert into public.profiles (id, handle, display_name)
select u.id,
       left(lower(regexp_replace(split_part(coalesce(u.email,'user'),'@',1),'[^a-z0-9_.]','','g')) || '_' || left(replace(u.id::text,'-',''), 4), 20),
       ''
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
