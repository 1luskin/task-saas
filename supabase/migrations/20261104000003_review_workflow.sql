-- =====================================================================
-- Etappe 2: Prüfung der Arbeit (review/rework), Abnahme, eigene Status
-- new → in_progress → review → done, plus rework ("Nacharbeit").
-- Mitarbeiter: new→in_progress, rework→in_progress, in_progress/new/rework→review.
-- NUR Chef (oder Auto-Abnahme per Cron/service_role) setzt done.
-- Verdienst wird erst nach Abnahme (accepted_at) gezählt.
-- =====================================================================

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('new', 'in_progress', 'review', 'rework', 'done'));

alter table public.tasks
  add column submitted_at timestamptz,
  add column accepted_at timestamptz,
  add column accepted_by uuid references public.members(id) on delete set null,
  add column rating smallint check (rating between 1 and 5),
  add column rework_count integer not null default 0,
  add column review_reminded_at timestamptz,
  add column custom_status_id uuid;

-- Bestehende erledigte Aufgaben gelten als abgenommen
update public.tasks set accepted_at = coalesce(completed_at, updated_at) where status = 'done' and accepted_at is null;

create index tasks_review_idx on public.tasks(firm_id, status, submitted_at) where status = 'review';
create index tasks_accepted_idx on public.tasks(firm_id, accepted_at);

-- Auto-Abnahme nach N Tagen (null = aus)
alter table public.firms add column auto_accept_days smallint default 3 check (auto_accept_days is null or auto_accept_days between 1 and 60);

-- ---------------------------------------------------------------------
-- Eigene Status der Firma (Spalten im Kanban). kind = Systemetappe.
-- ---------------------------------------------------------------------
create table public.task_statuses (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default 'slate' check (color in ('slate', 'blue', 'amber', 'red', 'green', 'violet', 'teal')),
  position   integer not null default 0,
  kind       text not null check (kind in ('new', 'in_progress', 'review', 'rework', 'done')),
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);
create index task_statuses_firm_idx on public.task_statuses(firm_id, position);
-- genau ein Systemstatus pro Etappe
create unique index task_statuses_system_kind on public.task_statuses(firm_id, kind) where is_system;

alter table public.tasks
  add constraint tasks_custom_status_fk foreign key (custom_status_id) references public.task_statuses(id) on delete set null;

alter table public.task_statuses enable row level security;
create policy statuses_select on public.task_statuses for select to authenticated
  using (firm_id = private.my_firm_id());
create policy statuses_write on public.task_statuses for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- Systemstatus: nicht löschbar, Etappe nicht änderbar (nur umbenennen/Farbe/Reihenfolge)
create or replace function private.guard_task_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null then
      raise exception 'system status' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.is_system and (new.kind is distinct from old.kind or new.is_system is distinct from old.is_system or new.firm_id is distinct from old.firm_id) then
    raise exception 'system status' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger task_statuses_guard before update or delete on public.task_statuses
  for each row execute function private.guard_task_status();

create or replace function private.seed_task_statuses(p_firm uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.task_statuses (firm_id, name, color, position, kind, is_system) values
    (p_firm, 'Neu',        'slate', 0, 'new',         true),
    (p_firm, 'In Arbeit',  'blue',  1, 'in_progress', true),
    (p_firm, 'Zur Prüfung','amber', 2, 'review',      true),
    (p_firm, 'Nacharbeit', 'red',   3, 'rework',      true),
    (p_firm, 'Erledigt',   'green', 4, 'done',        true)
  on conflict do nothing;
$$;

create or replace function private.on_firm_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_task_statuses(new.id);
  return new;
end $$;
create trigger firms_seed_statuses after insert on public.firms
  for each row execute function private.on_firm_created();

select private.seed_task_statuses(id) from public.firms;

-- ---------------------------------------------------------------------
-- Guard für Aufgaben neu: Statusübergänge + Abnahmefelder
-- ---------------------------------------------------------------------
create or replace function private.guard_task_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_member public.members%rowtype;
  v_is_staff boolean := auth.uid() is not null and not private.is_boss();
begin
  if tg_op = 'UPDATE' and v_is_staff then
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
       or new.overdue_notified_at is distinct from old.overdue_notified_at
       or new.accepted_at is distinct from old.accepted_at
       or new.accepted_by is distinct from old.accepted_by
       or new.rating is distinct from old.rating
       or new.rework_count is distinct from old.rework_count
       or new.review_reminded_at is distinct from old.review_reminded_at
       or new.custom_status_id is distinct from old.custom_status_id then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    -- erlaubte Übergänge für Mitarbeiter
    if new.status is distinct from old.status and not (
         (old.status = 'new'         and new.status in ('in_progress', 'review'))
      or (old.status = 'rework'      and new.status in ('in_progress', 'review'))
      or (old.status = 'in_progress' and new.status in ('review', 'new'))
    ) then
      raise exception 'status transition not allowed' using errcode = '42501', hint = 'transition';
    end if;
  end if;

  if tg_op = 'INSERT' and v_is_staff then
    raise exception 'not allowed' using errcode = '42501';
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

  -- Eigener Status: gehört zur Firma; bestimmt die Etappe. Etappenwechsel ohne
  -- passenden eigenen Status setzt ihn zurück.
  if new.custom_status_id is not null then
    declare
      v_kind text;
      v_firm uuid;
    begin
      select kind, firm_id into v_kind, v_firm from public.task_statuses where id = new.custom_status_id;
      if v_firm is distinct from new.firm_id then
        raise exception 'invalid status' using errcode = '23514';
      end if;
      if tg_op = 'UPDATE' and new.custom_status_id is distinct from old.custom_status_id then
        new.status := v_kind;
      elsif v_kind <> new.status then
        new.custom_status_id := null;
      end if;
    end;
  end if;

  -- Abgabe zur Prüfung
  if new.status = 'review' and (tg_op = 'INSERT' or old.status <> 'review') then
    new.submitted_at := now();
    new.review_reminded_at := null;
  end if;
  -- Rückgabe zur Nacharbeit zählt
  if tg_op = 'UPDATE' and new.status = 'rework' and old.status <> 'rework' then
    new.rework_count := old.rework_count + 1;
  end if;
  -- Abnahme
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
    new.accepted_at := coalesce(new.accepted_at, now());
    new.accepted_by := coalesce(new.accepted_by, private.my_member_id());
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.accepted_at := null;
    new.accepted_by := null;
    new.rating := null;
  end if;
  return new;
end $$;
