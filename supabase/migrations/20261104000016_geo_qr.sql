-- =====================================================================
-- Etappe 13: Standortpunkte NUR bei Begonnen/Fertig und Schichtbeginn/-ende
-- (keine laufende Ortung), Einwilligung, Geozone, Aufbewahrung (Standard 90 Tage).
-- =====================================================================

alter table public.tasks
  add column lat double precision check (lat is null or lat between -90 and 90),
  add column lng double precision check (lng is null or lng between -180 and 180);

alter table public.firms
  add column geofence_radius_m integer check (geofence_radius_m is null or geofence_radius_m between 50 and 5000),
  add column geo_retention_days smallint not null default 90 check (geo_retention_days between 7 and 365);

create table public.geo_points (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  kind       text not null check (kind in ('task_start', 'task_finish', 'shift_start', 'shift_end')),
  task_id    uuid references public.tasks(id) on delete cascade,
  shift_id   uuid references public.shifts(id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  accuracy_m integer check (accuracy_m is null or accuracy_m >= 0),
  created_at timestamptz not null default now()
);
create index geo_points_firm_idx on public.geo_points(firm_id, created_at);
create index geo_points_task_idx on public.geo_points(task_id);
alter table public.geo_points enable row level security;
create policy geo_select on public.geo_points for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
-- nur eigener Punkt, nur mit gültiger (letzter) Einwilligung
create policy geo_insert on public.geo_points for insert to authenticated
  with check (firm_id = private.my_firm_id() and member_id = private.my_member_id()
              and (task_id is null or private.can_see_task(task_id))
              and exists (
                select 1 from (
                  select c.granted from public.consents c
                  where c.user_id = auth.uid() and c.kind = 'geolocation'
                  order by c.created_at desc limit 1
                ) last where last.granted
              ));
-- kein Update/Delete durch Nutzer; Löschung über Aufbewahrungsfrist (Cron, service_role)

-- Koordinaten des Objekts setzt nur der Chef
create or replace function private.guard_task_extra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_boss()
     and (new.pinned is distinct from old.pinned or new.reminder_sent_at is distinct from old.reminder_sent_at
          or new.lat is distinct from old.lat or new.lng is distinct from old.lng) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;
