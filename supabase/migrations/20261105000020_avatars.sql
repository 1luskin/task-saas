-- =====================================================================
-- Etappe 1 (Rest): Profilfotos. Privater Bucket, Pfad {firm_id}/{member_id}/{uuid}.jpg,
-- lesen nur innerhalb der Firma, schreiben nur eigenes Bild (oder Chef).
-- Auslieferung über /api/avatar/{member} (prüft Firma), nie öffentlich.
-- =====================================================================
alter table public.members add column avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.my_firm_id()::text);
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.my_firm_id()::text
              and ((storage.foldername(name))[2] = private.my_member_id()::text or private.is_boss()));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.my_firm_id()::text
         and ((storage.foldername(name))[2] = private.my_member_id()::text or private.is_boss()));

-- avatar_path darf nur auf den eigenen Ordner zeigen
alter table public.members add constraint members_avatar_path_own
  check (avatar_path is null or avatar_path like firm_id::text || '/' || id::text || '/%');
