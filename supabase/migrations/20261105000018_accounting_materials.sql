-- =====================================================================
-- Etappe 15: Buchhaltungs-Einstellungen (DATEV, USt), Materiallager.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Firma: DATEV-Stammdaten + Umsatzsteuer (auch für Rechnungen in Etappe 16)
-- ---------------------------------------------------------------------
alter table public.firms
  add column datev_consultant_no integer check (datev_consultant_no is null or datev_consultant_no between 1001 and 9999999),
  add column datev_client_no     integer check (datev_client_no is null or datev_client_no between 1 and 99999),
  add column datev_skr           text not null default '03' check (datev_skr in ('03', '04')),
  -- Konten-Überschreibungen {debitor, cash, expense, material} – leer = Standard des SKR
  add column datev_accounts      jsonb not null default '{}'::jsonb,
  add column vat_rate            smallint not null default 19 check (vat_rate in (0, 7, 19)),
  add column small_business      boolean not null default false; -- Kleinunternehmer § 19 UStG

-- ---------------------------------------------------------------------
-- Material
-- ---------------------------------------------------------------------
create table public.materials (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  unit            text not null default 'Stk' check (char_length(unit) between 1 and 20),
  stock           numeric(12, 3) not null default 0,
  min_stock       numeric(12, 3) not null default 0 check (min_stock >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents between 0 and 10000000),
  low_notified_at timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index materials_firm_idx on public.materials(firm_id);
alter table public.materials enable row level security;
-- Mitarbeiter sehen die Liste (zum Buchen auf ihre Aufgabe), ändern nur der Chef
create policy materials_select on public.materials for select to authenticated using (firm_id = private.my_firm_id());
create policy materials_boss on public.materials for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));

create table public.material_moves (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id) on delete cascade,
  material_id     uuid not null references public.materials(id) on delete cascade,
  kind            text not null check (kind in ('in', 'use', 'correction')),
  qty             numeric(12, 3) not null check (qty <> 0),
  unit_cost_cents integer not null default 0,
  task_id         uuid references public.tasks(id) on delete set null,
  member_id       uuid references public.members(id) on delete set null,
  expense_id      uuid references public.expenses(id) on delete set null,
  note            text check (note is null or char_length(note) <= 300),
  created_at      timestamptz not null default now()
);
create index material_moves_mat_idx on public.material_moves(material_id, created_at desc);
create index material_moves_task_idx on public.material_moves(task_id);
alter table public.material_moves enable row level security;
create policy material_moves_select on public.material_moves for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()
         or (task_id is not null and private.can_see_task(task_id))));
-- Schreiben nur über die RPCs unten (atomar mit Bestand)

-- Ausgaben: Herkunft (manuell / Materialentnahme) – Materialentnahmen gehen nicht in DATEV (Einkauf wird gebucht)
alter table public.expenses add column source text not null default 'manual' check (source in ('manual', 'material'));

-- Entnahme auf eine Aufgabe: Bestand sperren, prüfen, abziehen, Ausgabe (genehmigt) anlegen
create or replace function public.use_material(p_material uuid, p_task uuid, p_qty numeric)
returns table (stock numeric, min_stock numeric, low boolean, first_low boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_me   uuid := private.my_member_id();
  v_firm uuid := private.my_firm_id();
  v_mat  public.materials%rowtype;
  v_exp  uuid;
  v_cost integer;
  v_first boolean := false;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not private.firm_can_write(v_firm) then raise exception 'trial expired' using errcode = '42501', hint = 'expired'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > 100000 then raise exception 'invalid qty' using errcode = '22023'; end if;
  if not private.can_see_task(p_task) or not exists (select 1 from public.tasks t where t.id = p_task and t.firm_id = v_firm) then
    raise exception 'not found' using errcode = '42501';
  end if;
  select * into v_mat from public.materials m where m.id = p_material and m.firm_id = v_firm and m.archived_at is null for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if v_mat.stock < p_qty then
    raise exception 'insufficient stock' using errcode = '23514', hint = 'insufficient_stock';
  end if;
  update public.materials m set stock = m.stock - p_qty where m.id = v_mat.id;
  v_cost := round(p_qty * v_mat.unit_cost_cents);
  if v_cost > 0 then
    insert into public.expenses (firm_id, task_id, member_id, amount_cents, description, status, decided_by, decided_at, source)
    values (v_firm, p_task, v_me, v_cost,
            left(v_mat.name || ' × ' || trim(trailing '.' from trim(trailing '0' from p_qty::text)) || ' ' || v_mat.unit, 300),
            'approved', v_me, now(), 'material')
    returning id into v_exp;
  end if;
  insert into public.material_moves (firm_id, material_id, kind, qty, unit_cost_cents, task_id, member_id, expense_id)
  values (v_firm, v_mat.id, 'use', -p_qty, v_mat.unit_cost_cents, p_task, v_me, v_exp);
  -- Warnung "geht zur Neige" nur beim Unterschreiten (einmal je Unterschreitung)
  if v_mat.stock - p_qty <= v_mat.min_stock and v_mat.low_notified_at is null then
    update public.materials m set low_notified_at = now() where m.id = v_mat.id;
    v_first := true;
  end if;
  return query select v_mat.stock - p_qty, v_mat.min_stock, (v_mat.stock - p_qty <= v_mat.min_stock), v_first;
end $$;
revoke all on function public.use_material(uuid, uuid, numeric) from public, anon;
grant execute on function public.use_material(uuid, uuid, numeric) to authenticated;

-- Zugang / Korrektur (nur Chef)
create or replace function public.adjust_material_stock(p_material uuid, p_qty numeric, p_kind text, p_unit_cost_cents integer default null, p_note text default null)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_firm uuid := private.my_firm_id();
  v_mat  public.materials%rowtype;
begin
  if not private.is_boss() then raise exception 'not allowed' using errcode = '42501'; end if;
  if not private.firm_can_write(v_firm) then raise exception 'trial expired' using errcode = '42501', hint = 'expired'; end if;
  if p_kind not in ('in', 'correction') or p_qty is null or p_qty = 0 or abs(p_qty) > 1000000 or (p_kind = 'in' and p_qty < 0) then
    raise exception 'invalid' using errcode = '22023';
  end if;
  if p_unit_cost_cents is not null and (p_unit_cost_cents < 0 or p_unit_cost_cents > 10000000) then raise exception 'invalid' using errcode = '22023'; end if;
  select * into v_mat from public.materials m where m.id = p_material and m.firm_id = v_firm for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  update public.materials m
     set stock = m.stock + p_qty,
         unit_cost_cents = coalesce(p_unit_cost_cents, m.unit_cost_cents),
         low_notified_at = case when m.stock + p_qty > m.min_stock then null else m.low_notified_at end
   where m.id = v_mat.id;
  insert into public.material_moves (firm_id, material_id, kind, qty, unit_cost_cents, member_id, note)
  values (v_firm, v_mat.id, p_kind, p_qty, coalesce(p_unit_cost_cents, v_mat.unit_cost_cents), private.my_member_id(), nullif(trim(coalesce(p_note, '')), ''));
  return v_mat.stock + p_qty;
end $$;
revoke all on function public.adjust_material_stock(uuid, numeric, text, integer, text) from public, anon;
grant execute on function public.adjust_material_stock(uuid, numeric, text, integer, text) to authenticated;

-- Feature-Flags der Etappe
insert into public.feature_flags (key, default_enabled, description) values
  ('materials', true, 'Materiallager mit Entnahme auf Aufgaben'),
  ('datev',     true, 'DATEV-Export (Buchungsstapel EXTF)')
on conflict (key) do nothing;

-- Demo-Firma: Material
create or replace function private.seed_demo_materials(p_firm uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.materials (firm_id, name, unit, stock, min_stock, unit_cost_cents) values
    (p_firm, 'Fugenmörtel grau 5 kg', 'Sack', 3, 4, 1190),
    (p_firm, 'Allzweckreiniger 10 l', 'Kanister', 6, 2, 2450),
    (p_firm, 'Müllsäcke 120 l', 'Rolle', 25, 10, 390);
end $$;

create or replace function public.create_demo_firm()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_own public.members%rowtype;
  v_firm uuid;
  v_boss uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select firm_id into v_firm from public.members where user_id = v_uid and is_demo;
  if v_firm is not null then
    return v_firm;
  end if;
  select * into v_own from public.members where user_id = v_uid and not is_demo and archived_at is null;
  if v_own.id is null or v_own.role <> 'boss' then
    raise exception 'only bosses get a demo firm' using errcode = '42501';
  end if;
  insert into public.firms (name, is_demo, plan) values ('Demo · Glanz & Bau', true, 'trial') returning id into v_firm;
  insert into public.members (firm_id, user_id, role, full_name, email, locale, pay_mode, is_demo)
    values (v_firm, v_uid, 'boss', v_own.full_name, v_own.email, v_own.locale, 'fixed', true) returning id into v_boss;
  perform private.seed_demo_firm(v_firm, v_boss);
  perform private.seed_demo_extras(v_firm);
  perform private.seed_demo_clients(v_firm);
  perform private.seed_demo_team(v_firm);
  perform private.seed_demo_materials(v_firm);
  return v_firm;
end $$;
