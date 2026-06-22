-- ─────────────────────────────────────────────────────────────────────────────
-- Folio social — Phase 2: image storage for posts (+ avatars).
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- Public bucket so feed images load without signed URLs. Uploads are restricted
-- to authenticated users into their own user-id folder; anyone can read.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

-- Public read of everything in the bucket.
drop policy if exists "post_images_read" on storage.objects;
create policy "post_images_read"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- A signed-in user may upload/update/delete only within their own folder:
-- path looks like "<auth-uid>/<filename>".
drop policy if exists "post_images_insert_own" on storage.objects;
create policy "post_images_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post_images_update_own" on storage.objects;
create policy "post_images_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post_images_delete_own" on storage.objects;
create policy "post_images_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
