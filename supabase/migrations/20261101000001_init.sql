-- =====================================================================
-- Aufgaben & Verdienst – Grundschema
-- Alle Tabellen haben Row Level Security. Strikte Trennung pro Firma.
-- Geldbeträge immer in Cent (integer), Zeiten als timestamptz (UTC).
-- =====================================================================

create extension if not exists pgcrypto;

-- Hilfsfunktionen liegen im Schema "private", das NICHT über die API
-- (PostgREST) erreichbar ist.
create schema if not exists private;
grant usage on schema private to authenticated, anon;

-- ---------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------

create table public.firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  timezone    text not null default 'Europe/Berlin',
  created_at  timestamptz not null default now()
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  created_at  timestamptz not null default now(),
  unique (firm_id, name)
);

create table public.members (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms(id) on delete cascade,
  user_id            uuid unique references auth.users(id) on delete set null,
  role               text not null check (role in ('boss', 'employee')),
  full_name          text not null check (char_length(full_name) between 1 and 120),
  email              text,
  phone              text,
  group_id           uuid references public.groups(id) on delete set null,
  status             text not null default 'active' check (status in ('active', 'vacation', 'sick')),
  pay_mode           text not null default 'hourly' check (pay_mode in ('hourly', 'fixed', 'both')),
  hourly_rate_cents  integer not null default 0 check (hourly_rate_cents >= 0),
  locale             text not null default 'de' check (locale in ('de', 'ru')),
  notify_overdue     boolean not null default true,
  notify_done        boolean not null default true,
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index members_firm_idx on public.members(firm_id);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  role        text not null default 'employee' check (role in ('boss', 'employee')),
  group_id    uuid references public.groups(id) on delete set null,
  created_by  uuid references public.members(id) on delete set null,
  expires_at  timestamptz not null default now() + interval '14 days',
  max_uses    integer not null default 50 check (max_uses > 0),
  used_count  integer not null default 0,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index invites_firm_idx on public.invites(firm_id);

create table public.task_templates (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms(id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  description        text,
  address            text,
  assignee_id        uuid references public.members(id) on delete set null,
  priority           text not null default 'normal' check (priority in ('normal', 'urgent')),
  recurrence         text not null check (recurrence in ('daily', 'weekly', 'monthly')),
  weekdays           smallint[] not null default '{}',   -- ISO: 1 = Montag … 7 = Sonntag
  month_day          smallint check (month_day between 1 and 31),
  client_price_cents integer check (client_price_cents >= 0),
  fixed_pay_cents    integer check (fixed_pay_cents >= 0),
  checklist          text[] not null default '{}',
  active             boolean not null default true,
  last_run_on        date,
  created_at         timestamptz not null default now()
);
create index task_templates_firm_idx on public.task_templates(firm_id);

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms(id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  description         text,
  address             text,
  assignee_id         uuid references public.members(id) on delete set null,
  due_date            date,
  due_time            time,
  status              text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  priority            text not null default 'normal' check (priority in ('normal', 'urgent')),
  -- Feste Vergütung für den Mitarbeiter (sieht er selbst – es ist sein Verdienst).
  fixed_pay_cents     integer check (fixed_pay_cents >= 0),
  template_id         uuid references public.task_templates(id) on delete set null,
  created_by          uuid references public.members(id) on delete set null,
  completed_at        timestamptz,
  overdue_notified_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index tasks_firm_idx on public.tasks(firm_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_due_idx on public.tasks(firm_id, due_date);
create index tasks_status_idx on public.tasks(firm_id, status);

-- Kundenpreis liegt in einer eigenen Tabelle, die NUR Chefs lesen dürfen.
create table public.task_finance (
  task_id             uuid primary key references public.tasks(id) on delete cascade,
  firm_id             uuid not null references public.firms(id) on delete cascade,
  client_price_cents  integer not null default 0 check (client_price_cents >= 0),
  updated_at          timestamptz not null default now()
);
create index task_finance_firm_idx on public.task_finance(firm_id);

create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 300),
  done        boolean not null default false,
  position    integer not null default 0,
  updated_at  timestamptz not null default now()
);
create index checklist_task_idx on public.checklist_items(task_id);

create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  author_id   uuid references public.members(id) on delete set null,
  author_name text not null,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index comments_task_idx on public.task_comments(task_id);

create table public.task_photos (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  firm_id      uuid not null references public.firms(id) on delete cascade,
  storage_path text not null unique,
  uploaded_by  uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index photos_task_idx on public.task_photos(task_id);

-- Zeiterfassung "Begonnen"/"Fertig". id wird vom Client erzeugt (Offline-Sync, idempotent).
create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  -- Stundensatz-Snapshot beim Start (0 wenn Mitarbeiter nur Festpreis bekommt)
  rate_cents  integer not null default 0 check (rate_cents >= 0),
  created_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index time_entries_task_idx on public.time_entries(task_id);
create index time_entries_member_idx on public.time_entries(member_id, started_at);

create table public.task_requests (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  created_by   uuid not null references public.members(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text,
  address      text,
  due_date     date,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  task_id      uuid references public.tasks(id) on delete set null,
  decided_by   uuid references public.members(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index task_requests_firm_idx on public.task_requests(firm_id, status);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_member_idx on public.push_subscriptions(member_id);

-- ---------------------------------------------------------------------
-- Hilfsfunktionen (security definer → umgehen RLS gezielt, kein Rekursionsproblem)
-- ---------------------------------------------------------------------

create or replace function private.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.members m
  where m.user_id = auth.uid() and m.archived_at is null
  limit 1
$$;

create or replace function private.my_firm_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.firm_id from public.members m
  where m.user_id = auth.uid() and m.archived_at is null
  limit 1
$$;

create or replace function private.is_boss() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.role = 'boss' from public.members m
    where m.user_id = auth.uid() and m.archived_at is null
    limit 1
  ), false)
$$;

-- Darf der aktuelle Nutzer diese Aufgabe sehen?
create or replace function private.can_see_task(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task
      and t.firm_id = private.my_firm_id()
      and (private.is_boss() or t.assignee_id = private.my_member_id())
  )
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------

create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger members_touch before update on public.members
  for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks
  for each row execute function private.touch_updated_at();
create trigger checklist_touch before update on public.checklist_items
  for each row execute function private.touch_updated_at();
create trigger finance_touch before update on public.task_finance
  for each row execute function private.touch_updated_at();

-- Mitarbeiter dürfen an ihrem eigenen Profil nur unkritische Felder ändern.
create or replace function private.guard_member_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_boss() then
    return new;
  end if;
  if new.firm_id is distinct from old.firm_id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.group_id is distinct from old.group_id
     or new.pay_mode is distinct from old.pay_mode
     or new.hourly_rate_cents is distinct from old.hourly_rate_cents
     or new.archived_at is distinct from old.archived_at
     or new.email is distinct from old.email then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger members_guard before update on public.members
  for each row execute function private.guard_member_update();

-- Aufgaben: Mitarbeiter dürfen nur den Status ändern. Zuweisung nur an
-- aktive Mitglieder derselben Firma (nicht im Urlaub / krank).
create or replace function private.guard_task_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members%rowtype;
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and not private.is_boss() then
    if new.firm_id is distinct from old.firm_id
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.address is distinct from old.address
       or new.assignee_id is distinct from old.assignee_id
       or new.due_date is distinct from old.due_date
       or new.due_time is distinct from old.due_time
       or new.priority is distinct from old.priority
       or new.fixed_pay_cents is distinct from old.fixed_pay_cents
       or new.template_id is distinct from old.template_id
       or new.created_by is distinct from old.created_by
       or new.overdue_notified_at is distinct from old.overdue_notified_at then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;

  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    select * into v_member from public.members where id = new.assignee_id;
    if not found or v_member.firm_id <> new.firm_id or v_member.archived_at is not null then
      raise exception 'invalid assignee' using errcode = '23514';
    end if;
    if v_member.status <> 'active' then
      raise exception 'assignee unavailable' using errcode = '23514', hint = 'member_unavailable';
    end if;
  end if;

  -- Abschlusszeitpunkt pflegen
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function private.guard_task_write();

-- Checkliste: Mitarbeiter dürfen nur "done" umschalten.
create or replace function private.guard_checklist_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_boss() then
    return new;
  end if;
  if new.text is distinct from old.text
     or new.position is distinct from old.position
     or new.task_id is distinct from old.task_id
     or new.firm_id is distinct from old.firm_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger checklist_guard before update on public.checklist_items
  for each row execute function private.guard_checklist_update();

-- firm_id von Kindtabellen immer aus der Aufgabe übernehmen (kein Fälschen möglich)
create or replace function private.inherit_task_firm() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select t.firm_id into new.firm_id from public.tasks t where t.id = new.task_id;
  if new.firm_id is null then
    raise exception 'task not found' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger checklist_firm before insert on public.checklist_items
  for each row execute function private.inherit_task_firm();
create trigger comments_firm before insert on public.task_comments
  for each row execute function private.inherit_task_firm();
create trigger photos_firm before insert on public.task_photos
  for each row execute function private.inherit_task_firm();
create trigger finance_firm before insert on public.task_finance
  for each row execute function private.inherit_task_firm();
create trigger time_entries_firm before insert on public.time_entries
  for each row execute function private.inherit_task_firm();

-- Zeiterfassung: Stundensatz-Snapshot setzen, Mitarbeiter darf nur ended_at setzen.
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
    new.rate_cents := case when v_member.pay_mode in ('hourly', 'both')
                           then v_member.hourly_rate_cents else 0 end;
    return new;
  end if;

  if auth.uid() is not null and not private.is_boss() then
    if new.started_at is distinct from old.started_at
       or new.member_id is distinct from old.member_id
       or new.task_id is distinct from old.task_id
       or new.rate_cents is distinct from old.rate_cents
       or old.ended_at is not null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger time_entries_guard before insert or update on public.time_entries
  for each row execute function private.guard_time_entry();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.firms              enable row level security;
alter table public.groups             enable row level security;
alter table public.members            enable row level security;
alter table public.invites            enable row level security;
alter table public.task_templates     enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_finance       enable row level security;
alter table public.checklist_items    enable row level security;
alter table public.task_comments      enable row level security;
alter table public.task_photos        enable row level security;
alter table public.time_entries       enable row level security;
alter table public.task_requests      enable row level security;
alter table public.push_subscriptions enable row level security;

-- firms
create policy firms_select on public.firms for select to authenticated
  using (id = private.my_firm_id());
create policy firms_update on public.firms for update to authenticated
  using (id = private.my_firm_id() and private.is_boss())
  with check (id = private.my_firm_id() and private.is_boss());

-- groups
create policy groups_select on public.groups for select to authenticated
  using (firm_id = private.my_firm_id());
create policy groups_write on public.groups for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- members: Chef sieht alle der Firma, Mitarbeiter nur sich selbst
create policy members_select on public.members for select to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or user_id = auth.uid()));
create policy members_update_boss on public.members for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id());
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy members_insert_boss on public.members for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- invites (nur Chefs)
create policy invites_boss on public.invites for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- task_templates (nur Chefs)
create policy templates_boss on public.task_templates for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or assignee_id = private.my_member_id()));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy tasks_update on public.tasks for update to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or assignee_id = private.my_member_id()))
  with check (firm_id = private.my_firm_id()
         and (private.is_boss() or assignee_id = private.my_member_id()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

-- task_finance (nur Chefs)
create policy finance_boss on public.task_finance for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- checklist_items
create policy checklist_select on public.checklist_items for select to authenticated
  using (private.can_see_task(task_id));
create policy checklist_update on public.checklist_items for update to authenticated
  using (private.can_see_task(task_id))
  with check (private.can_see_task(task_id));
create policy checklist_insert on public.checklist_items for insert to authenticated
  with check (private.is_boss() and private.can_see_task(task_id));
create policy checklist_delete on public.checklist_items for delete to authenticated
  using (private.is_boss() and private.can_see_task(task_id));

-- task_comments
create policy comments_select on public.task_comments for select to authenticated
  using (private.can_see_task(task_id));
create policy comments_insert on public.task_comments for insert to authenticated
  with check (private.can_see_task(task_id) and author_id = private.my_member_id());
create policy comments_delete on public.task_comments for delete to authenticated
  using (private.can_see_task(task_id)
         and (private.is_boss() or author_id = private.my_member_id()));

-- task_photos
create policy photos_select on public.task_photos for select to authenticated
  using (private.can_see_task(task_id));
create policy photos_insert on public.task_photos for insert to authenticated
  with check (private.can_see_task(task_id) and uploaded_by = private.my_member_id());
create policy photos_delete on public.task_photos for delete to authenticated
  using (private.can_see_task(task_id)
         and (private.is_boss() or uploaded_by = private.my_member_id()));

-- time_entries
create policy time_select on public.time_entries for select to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or member_id = private.my_member_id()));
create policy time_insert on public.time_entries for insert to authenticated
  with check (private.can_see_task(task_id)
              and (member_id = private.my_member_id() or private.is_boss()));
create policy time_update on public.time_entries for update to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or member_id = private.my_member_id()))
  with check (firm_id = private.my_firm_id()
         and (private.is_boss() or member_id = private.my_member_id()));
create policy time_delete on public.time_entries for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

-- task_requests
create policy requests_select on public.task_requests for select to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or created_by = private.my_member_id()));
create policy requests_insert on public.task_requests for insert to authenticated
  with check (firm_id = private.my_firm_id()
              and created_by = private.my_member_id()
              and status = 'pending');
create policy requests_update on public.task_requests for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy requests_delete on public.task_requests for delete to authenticated
  using (firm_id = private.my_firm_id()
         and (private.is_boss() or (created_by = private.my_member_id() and status = 'pending')));

-- push_subscriptions (nur eigene)
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and member_id = private.my_member_id());

-- ---------------------------------------------------------------------
-- RPCs für Onboarding (der Nutzer ist hier noch kein Mitglied → security definer)
-- ---------------------------------------------------------------------

create or replace function public.create_firm(p_firm_name text, p_full_name text, p_locale text default 'de')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_firm uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already member' using errcode = '23505';
  end if;
  if char_length(trim(coalesce(p_firm_name, ''))) = 0
     or char_length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = v_uid;

  insert into public.firms (name) values (trim(p_firm_name)) returning id into v_firm;
  insert into public.members (firm_id, user_id, role, full_name, email, locale, pay_mode)
  values (v_firm, v_uid, 'boss', trim(p_full_name), v_email,
          case when p_locale in ('de', 'ru') then p_locale else 'de' end, 'fixed');
  return v_firm;
end $$;

-- Öffentliche Infos zu einer Einladung (Firmenname) – ohne Login lesbar.
create or replace function public.invite_info(p_token text)
returns table (firm_name text, role text, valid boolean)
language sql stable security definer set search_path = '' as $$
  select f.name, i.role,
         (not i.revoked and i.expires_at > now() and i.used_count < i.max_uses)
  from public.invites i
  join public.firms f on f.id = i.firm_id
  where i.token = p_token
$$;

create or replace function public.accept_invite(p_token text, p_full_name text, p_locale text default 'de')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.invites%rowtype;
  v_member uuid;
  v_email  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already member' using errcode = '23505';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'invalid input' using errcode = '22023';
  end if;

  select * into v_inv from public.invites where token = p_token for update;
  if not found or v_inv.revoked or v_inv.expires_at <= now() or v_inv.used_count >= v_inv.max_uses then
    raise exception 'invite invalid' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = v_uid;
  insert into public.members (firm_id, user_id, role, full_name, email, group_id, locale)
  values (v_inv.firm_id, v_uid, v_inv.role, trim(p_full_name), v_email, v_inv.group_id,
          case when p_locale in ('de', 'ru') then p_locale else 'de' end)
  returning id into v_member;

  update public.invites set used_count = used_count + 1 where id = v_inv.id;
  return v_member;
end $$;

revoke all on function public.create_firm(text, text, text) from public, anon;
revoke all on function public.accept_invite(text, text, text) from public, anon;
grant execute on function public.create_firm(text, text, text) to authenticated;
grant execute on function public.accept_invite(text, text, text) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
