-- =====================================================================
-- Etappe 7: Feature-Flags (global + pro Firma), Superadmin-Protokoll,
-- Übersicht/Statistik für den Superadmin (nur service_role).
-- =====================================================================

create table public.feature_flags (
  key             text primary key check (key ~ '^[a-z_]{2,40}$'),
  default_enabled boolean not null default true,
  description     text,
  updated_at      timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
create policy feature_flags_read on public.feature_flags for select to authenticated using (true);

insert into public.feature_flags (key, default_enabled, description) values
  ('templates',     true,  'Vorlagen für wiederkehrende Aufgaben'),
  ('requests',      true,  'Anfragen von Mitarbeitern'),
  ('reports',       true,  'Berichte (PDF)'),
  ('excel_export',  true,  'Excel-Export'),
  ('custom_statuses', true, 'Eigene Status der Firma'),
  ('demo_firm',     true,  'Demo-Firma (Sandbox)'),
  ('kanban',        true,  'Kanban-Ansicht'),
  ('clients',       true,  'Kunden & Kunden-Link'),
  ('expenses',      true,  'Ausgaben'),
  ('shifts',        true,  'Schichten'),
  ('geolocation',   false, 'Standort bei Begonnen/Fertig'),
  ('invoices',      false, 'Rechnungen & Angebote'),
  ('public_form',   false, 'Öffentliche Anfrage-Seite')
on conflict do nothing;

-- Überschreibungen pro Firma. setby: 'admin' (Superadmin) oder 'boss' (Einstellungen der Firma).
-- Ein vom Admin gesperrtes Feature (setby='admin', enabled=false) kann der Chef nicht einschalten.
create table public.firm_features (
  firm_id    uuid not null references public.firms(id) on delete cascade,
  key        text not null references public.feature_flags(key) on delete cascade,
  enabled    boolean not null,
  set_by     text not null default 'boss' check (set_by in ('admin', 'boss')),
  updated_at timestamptz not null default now(),
  primary key (firm_id, key)
);
alter table public.firm_features enable row level security;
create policy firm_features_select on public.firm_features for select to authenticated
  using (firm_id = private.my_firm_id());
create policy firm_features_boss_write on public.firm_features for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and set_by = 'boss');
create policy firm_features_boss_update on public.firm_features for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss() and set_by = 'boss')
  with check (firm_id = private.my_firm_id() and private.is_boss() and set_by = 'boss');

-- Protokoll aller Superadmin-Aktionen (nur service_role)
create table public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action      text not null,
  target      text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_created on public.admin_audit(created_at desc);
alter table public.admin_audit enable row level security;
-- keine Policies: nur service_role

-- Übersicht aller echten Firmen für den Superadmin
create or replace function public.admin_firm_overview()
returns table (
  id uuid, name text, created_at timestamptz, plan text, trial_ends_at timestamptz, is_demo boolean,
  members integer, tasks integer, last_activity timestamptz, owner_email text, deletion_scheduled_for timestamptz
)
language sql stable security definer set search_path = '' as $$
  select f.id, f.name, f.created_at, f.plan, f.trial_ends_at, f.is_demo,
         (select count(*) from public.members m where m.firm_id = f.id and m.archived_at is null)::int,
         (select count(*) from public.tasks t where t.firm_id = f.id)::int,
         greatest(
           (select max(t.updated_at) from public.tasks t where t.firm_id = f.id),
           (select max(e.created_at) from public.time_entries e where e.firm_id = f.id),
           f.created_at),
         coalesce(f.contact_email, (select m.email from public.members m where m.firm_id = f.id and m.role = 'boss' order by m.created_at limit 1)),
         f.deletion_scheduled_for
  from public.firms f
  where not f.is_demo
  order by f.created_at desc
$$;
revoke all on function public.admin_firm_overview() from public, anon, authenticated;
grant execute on function public.admin_firm_overview() to service_role;
