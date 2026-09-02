-- Students manage their own profile images from the dashboard settings page.
-- Keep the bucket public so stored avatar URLs can be rendered directly after
-- upload while still restricting writes to the owning authenticated user.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_images_upload_own_folder on storage.objects;
create policy profile_images_upload_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists profile_images_update_own_folder on storage.objects;
create policy profile_images_update_own_folder on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-images'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists profile_images_delete_own_folder on storage.objects;
create policy profile_images_delete_own_folder on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and split_part(name, '/', 1) = auth.uid()::text
  );