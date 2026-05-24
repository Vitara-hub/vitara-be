-- Supabase Storage bucket + policies for food images.
-- Guarded so migration tetap aman saat dijalankan di local Postgres-only compose.
do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'storage'
  ) then
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    values (
      'food-images',
      'food-images',
      false,
      5242880,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id)
    do update set
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


    execute 'drop policy if exists "food_images_insert_own" on storage.objects';
    execute 'create policy "food_images_insert_own" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = ''food-images''
        and (storage.foldername(name))[1] = auth.uid()::text
      )';

    execute 'drop policy if exists "food_images_select_own" on storage.objects';
    execute 'create policy "food_images_select_own" on storage.objects
      for select to authenticated
      using (
        bucket_id = ''food-images''
        and (storage.foldername(name))[1] = auth.uid()::text
      )';

    execute 'drop policy if exists "food_images_update_own" on storage.objects';
    execute 'create policy "food_images_update_own" on storage.objects
      for update to authenticated
      using (
        bucket_id = ''food-images''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = ''food-images''
        and (storage.foldername(name))[1] = auth.uid()::text
      )';

    execute 'drop policy if exists "food_images_delete_own" on storage.objects';
    execute 'create policy "food_images_delete_own" on storage.objects
      for delete to authenticated
      using (
        bucket_id = ''food-images''
        and (storage.foldername(name))[1] = auth.uid()::text
      )';
  end if;
end
$$;
