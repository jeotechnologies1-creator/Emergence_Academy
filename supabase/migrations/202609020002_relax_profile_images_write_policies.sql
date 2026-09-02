-- Some environments still run older dashboard bundles that upload avatar
-- objects under a different UUID folder key. To prevent profile photo
-- failures while clients update, allow authenticated writes across the
-- profile-images bucket and rely on authenticated access control.

drop policy if exists profile_images_upload_own_folder on storage.objects;
drop policy if exists profile_images_update_own_folder on storage.objects;
drop policy if exists profile_images_delete_own_folder on storage.objects;

drop policy if exists profile_images_upload_authenticated on storage.objects;
create policy profile_images_upload_authenticated on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-images');

drop policy if exists profile_images_update_authenticated on storage.objects;
create policy profile_images_update_authenticated on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-images')
  with check (bucket_id = 'profile-images');

drop policy if exists profile_images_delete_authenticated on storage.objects;
create policy profile_images_delete_authenticated on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-images');