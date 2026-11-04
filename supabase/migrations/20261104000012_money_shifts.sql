-- =====================================================================
-- Etappe 9: Ausgaben (mit Beleg), Schichten (Start/Pause/Ende, Auto-Ende),
-- Arbeitszeiterfassung mit Änderungshistorie, Prämien/Abzüge.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ausgaben
-- ---------------------------------------------------------------------
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  description  text not null check (char_length(description) between 1 and 300),
  receipt_path text,
  reimburse    boolean not null default false, -- an den Mitarbeiter erstatten (aus eigener Tasche bezahlt)
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by   uuid references public.members(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index expenses_firm_idx on public.expenses(firm_id, status);
create index expenses_task_idx on public.expenses(task_id);
alter table public.expenses enable row level security;

create trigger expenses_firm before insert on public.expenses
  for each row execute function private.inherit_task_firm();

create policy expenses_select on public.expenses for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (private.can_see_task(task_id) and member_id = private.my_member_id()
              and status = 'pending' and private.firm_can_write(private.my_firm_id()));
create policy expenses_update_boss on public.expenses for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy expenses_delete_own on public.expenses for delete to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or (member_id = private.my_member_id() and status = 'pending')));

-- Belege: privater Bucket, Pfad {firm_id}/{task_id}/{uuid}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and private.can_access_photo_path(name));
create policy receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and private.can_access_photo_path(name));

-- ---------------------------------------------------------------------
-- Schichten
-- ---------------------------------------------------------------------
alter table public.members
  add column hourly_basis text not null default 'tasks' check (hourly_basis in ('tasks', 'shifts'));

create table public.shifts (
  id               uuid primary key default gen_random_uuid(), -- vom Client erzeugt (Offline, idempotent)
  firm_id          uuid not null references public.firms(id) on delete cascade,
  member_id        uuid not null references public.members(id) on delete cascade,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  break_minutes    integer not null default 0 check (break_minutes >= 0),
  break_started_at timestamptz,
  rate_cents       integer not null default 0 check (rate_cents >= 0),
  auto_closed      boolean not null default false,
  needs_review     boolean not null default false,
  created_at       timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index shifts_member_idx on public.shifts(member_id, started_at desc);
create index shifts_open_idx on public.shifts(firm_id) where ended_at is null;
-- höchstens eine offene Schicht pro Mitarbeiter
create unique index shifts_one_open on public.shifts(member_id) where ended_at is null;
alter table public.shifts enable row level security;

create policy shifts_select on public.shifts for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy shifts_insert on public.shifts for insert to authenticated
  with check (firm_id = private.my_firm_id() and member_id = private.my_member_id() and private.firm_can_write(firm_id));
create policy shifts_update on public.shifts for update to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()))
  with check (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
-- KEIN delete: Arbeitszeitaufzeichnungen werden nie still gelöscht

-- Stundensatz: nach Aufgaben ODER nach Schichten (pro Mitarbeiter wählbar)
create or replace function private.guard_time_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_member from public.members where id = new.member_id;
    if not found or v_member.firm_id <> new.firm_id then
      raise exception 'invalid member' using errcode = '23514';
    end if;
    new.rate_cents := case when v_member.pay_mode in ('hourly', 'both') and v_member.hourly_basis = 'tasks'
                           then v_member.hourly_rate_cents else 0 end;
    return new;
  end if;
  -- Änderungen an Start/Satz/Mitglied nur über edit_time_record (mit Historie)
  if auth.uid() is not null and coalesce(current_setting('app.time_edit', true), '') <> '1' then
    if new.started_at is distinct from old.started_at
       or new.member_id is distinct from old.member_id
       or new.task_id is distinct from old.task_id
       or new.rate_cents is distinct from old.rate_cents
       or (old.ended_at is not null and new.ended_at is distinct from old.ended_at) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function private.guard_shift() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into v_member from public.members where id = new.member_id;
    if not found or v_member.firm_id <> new.firm_id then
      raise exception 'invalid member' using errcode = '23514';
    end if;
    new.rate_cents := case when v_member.pay_mode in ('hourly', 'both') and v_member.hourly_basis = 'shifts'
                           then v_member.hourly_rate_cents else 0 end;
    new.auto_closed := false;
    new.needs_review := false;
    return new;
  end if;
  if auth.uid() is not null and coalesce(current_setting('app.time_edit', true), '') <> '1' then
    -- normaler Ablauf: Pause/Ende setzen; abgeschlossene Schichten nur per edit_time_record
    if new.started_at is distinct from old.started_at
       or new.member_id is distinct from old.member_id
       or new.firm_id is distinct from old.firm_id
       or new.rate_cents is distinct from old.rate_cents
       or new.auto_closed is distinct from old.auto_closed
       or old.ended_at is not null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger shifts_guard before insert or update on public.shifts
  for each row execute function private.guard_shift();

-- time_entries: Löschen auch für Chefs entfernen (nur mit Historie über RPC "nullen")
drop policy if exists time_delete on public.time_entries;

-- ---------------------------------------------------------------------
-- Änderungshistorie (Arbeitszeiterfassung)
-- ---------------------------------------------------------------------
create table public.time_edits (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade, -- wessen Zeit
  kind       text not null check (kind in ('shift', 'time_entry')),
  record_id  uuid not null,
  changed_by uuid references public.members(id) on delete set null,
  before     jsonb not null,
  after      jsonb not null,
  reason     text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
create index time_edits_member_idx on public.time_edits(member_id, created_at desc);
alter table public.time_edits enable row level security;
create policy time_edits_select on public.time_edits for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
-- Einfügen nur über edit_time_record

/** Chef korrigiert Schicht/Zeiteintrag – Begründung Pflicht, alt/neu wird protokolliert */
create or replace function public.edit_time_record(
  p_kind text, p_id uuid, p_started_at timestamptz, p_ended_at timestamptz, p_break_minutes integer, p_reason text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_member uuid;
  v_firm uuid;
begin
  if not private.is_boss() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if p_ended_at is not null and p_ended_at < p_started_at then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  perform set_config('app.time_edit', '1', true);
  if p_kind = 'shift' then
    select to_jsonb(s), s.member_id, s.firm_id into v_before, v_member, v_firm from public.shifts s where s.id = p_id;
    if v_firm is distinct from private.my_firm_id() then raise exception 'not found' using errcode = '42501'; end if;
    update public.shifts set started_at = p_started_at, ended_at = p_ended_at,
      break_minutes = greatest(coalesce(p_break_minutes, 0), 0), break_started_at = null, needs_review = false
    where id = p_id returning to_jsonb(shifts.*) into v_after;
  elsif p_kind = 'time_entry' then
    select to_jsonb(e), e.member_id, e.firm_id into v_before, v_member, v_firm from public.time_entries e where e.id = p_id;
    if v_firm is distinct from private.my_firm_id() then raise exception 'not found' using errcode = '42501'; end if;
    update public.time_entries set started_at = p_started_at, ended_at = p_ended_at
    where id = p_id returning to_jsonb(time_entries.*) into v_after;
  else
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  insert into public.time_edits (firm_id, member_id, kind, record_id, changed_by, before, after, reason)
  values (v_firm, v_member, p_kind, p_id, private.my_member_id(), v_before, v_after, trim(p_reason));
  perform set_config('app.time_edit', '', true);
end $$;
revoke all on function public.edit_time_record(text, uuid, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.edit_time_record(text, uuid, timestamptz, timestamptz, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- Prämien und Abzüge
-- ---------------------------------------------------------------------
create table public.adjustments (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  member_id      uuid not null references public.members(id) on delete cascade,
  amount_cents   integer not null check (amount_cents <> 0 and abs(amount_cents) <= 10000000), -- + Prämie, − Abzug
  reason         text not null check (char_length(reason) between 3 and 300),
  effective_date date not null,
  created_by     uuid references public.members(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index adjustments_member_idx on public.adjustments(member_id, effective_date);
alter table public.adjustments enable row level security;
create policy adjustments_select on public.adjustments for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy adjustments_insert on public.adjustments for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
-- keine Änderung/Löschung: Korrektur = Gegenbuchung (nachvollziehbar)

-- Guard: Mitarbeiter darf hourly_basis nicht ändern (Erweiterung der Prüfung)
create or replace function private.guard_member_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_boss() then
    if new.is_demo is distinct from old.is_demo and auth.uid() is not null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.firm_id is distinct from old.firm_id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.group_id is distinct from old.group_id
     or new.pay_mode is distinct from old.pay_mode
     or new.hourly_rate_cents is distinct from old.hourly_rate_cents
     or new.hourly_basis is distinct from old.hourly_basis
     or new.archived_at is distinct from old.archived_at
     or new.email is distinct from old.email
     or new.is_demo is distinct from old.is_demo then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Demo-Firma: Beispieldaten für Schichten, Ausgaben, Prämien
-- ---------------------------------------------------------------------
create or replace function private.seed_demo_extras(p_firm uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_boss uuid;
  e1 uuid; e2 uuid;
  t_review uuid; t_done uuid;
begin
  select id into v_boss from public.members where firm_id = p_firm and role = 'boss' limit 1;
  select id into e1 from public.members where firm_id = p_firm and full_name = 'Dmitri Iwanow';
  select id into e2 from public.members where firm_id = p_firm and full_name = 'Lukas Weber';
  select id into t_review from public.tasks where firm_id = p_firm and title = 'Badfliesen verfugen';
  select id into t_done from public.tasks where firm_id = p_firm and title = 'Malerarbeiten Flur';
  insert into public.shifts (firm_id, member_id, started_at) values (p_firm, e1, now() - interval '90 minutes');
  insert into public.shifts (firm_id, member_id, started_at, ended_at, break_minutes)
    values (p_firm, e2, now() - interval '30 hours', now() - interval '21 hours', 30);
  if t_review is not null then
    insert into public.expenses (task_id, member_id, amount_cents, description, reimburse)
      values (t_review, e2, 2380, '2 Säcke Fugenmörtel', true);
  end if;
  if t_done is not null then
    insert into public.expenses (task_id, member_id, amount_cents, description, status, decided_by, decided_at)
      values (t_done, e2, 6450, 'Farbe & Abdeckfolie', 'approved', v_boss, now());
  end if;
  insert into public.adjustments (firm_id, member_id, amount_cents, reason, effective_date, created_by)
    values (p_firm, e1, 2500, 'Sonntagseinsatz Hausverwaltung', (now() at time zone 'Europe/Berlin')::date, v_boss);
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
  return v_firm;
end $$;
