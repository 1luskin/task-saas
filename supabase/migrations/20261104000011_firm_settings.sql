-- =====================================================================
-- Etappe 8: Einstellungen der Firma – Logo, sichtbare Aufgabenfelder,
-- automatisches Schichtende. Bucket firm-logos (öffentlich, nur Bilder, klein).
-- =====================================================================

alter table public.firms
  add column logo_path text,
  add column task_fields jsonb not null default '{"description": true, "address": true, "due_time": true, "checklist": true, "client_price": true, "fixed_pay": true, "photos": true}'::jsonb,
  add column shift_autoclose_hours smallint not null default 12 check (shift_autoclose_hours between 4 and 24);

-- Öffentlicher Bucket nur für Logos (erscheinen auch auf dem Kunden-Link ohne Login)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firm-logos', 'firm-logos', true, 524288, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Pfad: {firm_id}/logo-{zufall}.{ext} – schreiben nur Chefs der eigenen Firma
create or replace function private.is_boss_of_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_boss() and (storage.foldername(p_name))[1] = private.my_firm_id()::text
$$;
grant execute on function private.is_boss_of_path(text) to authenticated;

create policy firm_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'firm-logos' and private.is_boss_of_path(name));
create policy firm_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'firm-logos' and private.is_boss_of_path(name));
create policy firm_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'firm-logos' and private.is_boss_of_path(name));
