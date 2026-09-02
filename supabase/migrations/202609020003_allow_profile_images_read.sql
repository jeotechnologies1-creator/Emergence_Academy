-- Storage upserts and object metadata reads require SELECT in addition to the
-- write policies. The bucket is public for avatar rendering; this policy lets
-- authenticated dashboard clients perform the corresponding Storage calls.

drop policy if exists profile_images_read_authenticated on storage.objects;
create policy profile_images_read_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-images');
