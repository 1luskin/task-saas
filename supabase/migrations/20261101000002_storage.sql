-- Privater Bucket für Aufgabenfotos.
-- Pfadschema: {firm_id}/{task_id}/{uuid}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create or replace function private.can_access_photo_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_parts text[] := storage.foldername(p_name);
  v_task  uuid;
begin
  if array_length(v_parts, 1) < 2 then
    return false;
  end if;
  if v_parts[1] <> private.my_firm_id()::text then
    return false;
  end if;
  begin
    v_task := v_parts[2]::uuid;
  exception when others then
    return false;
  end;
  return private.can_see_task(v_task);
end $$;
grant execute on function private.can_access_photo_path(text) to authenticated;

create policy task_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'task-photos' and private.can_access_photo_path(name));

create policy task_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'task-photos' and private.can_access_photo_path(name));

create policy task_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-photos' and private.can_access_photo_path(name)
         and (private.is_boss() or owner_id = auth.uid()::text));
