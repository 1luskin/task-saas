-- =====================================================================
-- Etappe 11: Anheften, Checklisten-Vorlagen, Dateien, Erinnerung vor Termin,
-- Ereignis-Feed (Trigger), Volltextsuche mit RLS.
-- =====================================================================

alter table public.tasks
  add column pinned boolean not null default false,
  add column reminder_sent_at timestamptz;
create index tasks_pinned_idx on public.tasks(firm_id) where pinned;

-- Mitarbeiter dürfen pinned/reminder nicht ändern (Guard ergänzen)
create or replace function private.guard_task_extra() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_boss()
     and (new.pinned is distinct from old.pinned or new.reminder_sent_at is distinct from old.reminder_sent_at) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- neuer Termin → Erinnerung erneut erlauben
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;
create trigger tasks_extra_guard before update on public.tasks
  for each row execute function private.guard_task_extra();

-- ---------------------------------------------------------------------
-- Checklisten-Vorlagen
-- ---------------------------------------------------------------------
create table public.checklist_templates (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  items      text[] not null default '{}' check (array_length(items, 1) is null or array_length(items, 1) <= 100),
  created_at timestamptz not null default now()
);
alter table public.checklist_templates enable row level security;
create policy checklist_templates_boss on public.checklist_templates for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- ---------------------------------------------------------------------
-- Dateien zu Aufgaben (und Kommentaren): privater Bucket, max. 10 MB
-- Pfad: {firm_id}/{task_id}/{uuid}-{name}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel', 'text/plain'])
on conflict (id) do nothing;
create policy task_files_read on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and private.can_access_photo_path(name));
create policy task_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and private.can_access_photo_path(name));
create policy task_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and private.can_access_photo_path(name) and (private.is_boss() or owner_id = auth.uid()::text));

create table public.task_files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  firm_id      uuid not null references public.firms(id) on delete cascade,
  comment_id   uuid references public.task_comments(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 200),
  mime_type    text not null,
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by  uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index task_files_task_idx on public.task_files(task_id);
alter table public.task_files enable row level security;
create trigger task_files_firm before insert on public.task_files
  for each row execute function private.inherit_task_firm();
create policy task_files_select on public.task_files for select to authenticated
  using (private.can_see_task(task_id));
create policy task_files_insert on public.task_files for insert to authenticated
  with check (private.can_see_task(task_id) and uploaded_by = private.my_member_id() and private.firm_can_write(private.my_firm_id()));
create policy task_files_delete on public.task_files for delete to authenticated
  using (private.can_see_task(task_id) and (private.is_boss() or uploaded_by = private.my_member_id()));

-- ---------------------------------------------------------------------
-- Ereignis-Feed ("wer hat was getan") – nur für Chefs sichtbar
-- ---------------------------------------------------------------------
create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid references public.members(id) on delete set null, -- wer
  kind       text not null,  -- status, shift_start, shift_end, expense, request, review, comment
  task_id    uuid references public.tasks(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_firm_idx on public.activity(firm_id, created_at desc);
create index activity_member_idx on public.activity(firm_id, member_id, created_at desc);
alter table public.activity enable row level security;
create policy activity_boss on public.activity for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

create or replace function private.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.my_member_id();
begin
  if tg_table_name = 'tasks' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      insert into public.activity (firm_id, member_id, kind, task_id, payload)
      values (new.firm_id, coalesce(v_actor, case when new.status = 'done' then null else new.assignee_id end), 'status', new.id,
              jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title, 'via', new.accepted_via));
    end if;
  elsif tg_table_name = 'shifts' then
    if tg_op = 'INSERT' then
      insert into public.activity (firm_id, member_id, kind) values (new.firm_id, new.member_id, 'shift_start');
    elsif new.ended_at is not null and old.ended_at is null then
      insert into public.activity (firm_id, member_id, kind, payload) values (new.firm_id, new.member_id, 'shift_end', jsonb_build_object('auto', new.auto_closed));
    end if;
  elsif tg_table_name = 'expenses' and tg_op = 'INSERT' then
    insert into public.activity (firm_id, member_id, kind, task_id, payload)
    values (new.firm_id, new.member_id, 'expense', new.task_id, jsonb_build_object('amount_cents', new.amount_cents, 'description', new.description));
  elsif tg_table_name = 'task_requests' and tg_op = 'INSERT' then
    insert into public.activity (firm_id, member_id, kind, payload) values (new.firm_id, new.created_by, 'request', jsonb_build_object('title', new.title));
  elsif tg_table_name = 'reviews' and tg_op = 'INSERT' then
    insert into public.activity (firm_id, kind, task_id, payload) values (new.firm_id, 'review', new.task_id, jsonb_build_object('rating', new.rating));
  elsif tg_table_name = 'task_comments' and tg_op = 'INSERT' then
    insert into public.activity (firm_id, member_id, kind, task_id, payload)
    values (new.firm_id, new.author_id, 'comment', new.task_id, jsonb_build_object('body', left(new.body, 140)));
  end if;
  return null;
end $$;
create trigger activity_tasks after update on public.tasks for each row execute function private.log_activity();
create trigger activity_shifts after insert or update on public.shifts for each row execute function private.log_activity();
create trigger activity_expenses after insert on public.expenses for each row execute function private.log_activity();
create trigger activity_requests after insert on public.task_requests for each row execute function private.log_activity();
create trigger activity_reviews after insert on public.reviews for each row execute function private.log_activity();
create trigger activity_comments after insert on public.task_comments for each row execute function private.log_activity();

-- ---------------------------------------------------------------------
-- Volltextsuche (config simple → DE und RU) – security invoker: RLS gilt,
-- Mitarbeiter findet nur Eigenes, Kunden/Mitarbeiter nur Chefs.
-- ---------------------------------------------------------------------
create index tasks_fts_idx on public.tasks using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(address, '')));

create or replace function public.search_all(p_q text, p_limit integer default 8)
returns table (kind text, id uuid, title text, subtitle text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_ts tsquery;
  v_like text;
begin
  if char_length(v_q) < 2 then
    return;
  end if;
  -- Präfixsuche: jedes Wort als "wort:*"
  v_ts := to_tsquery('simple', array_to_string(array(
    select regexp_replace(w, '[^[:alnum:]äöüßÄÖÜа-яА-ЯёЁ-]', '', 'g') || ':*'
    from unnest(regexp_split_to_array(lower(v_q), '\s+')) w
    where regexp_replace(w, '[^[:alnum:]äöüßÄÖÜа-яА-ЯёЁ-]', '', 'g') <> ''), ' & '));
  v_like := '%' || replace(replace(v_q, '%', ''), '_', '') || '%';
  return query
    (select 'task'::text, t.id, t.title, coalesce(t.address, '')
       from public.tasks t
      where to_tsvector('simple', coalesce(t.title, '') || ' ' || coalesce(t.description, '') || ' ' || coalesce(t.address, '')) @@ v_ts
      order by t.updated_at desc limit p_limit)
    union all
    (select 'member'::text, m.id, m.full_name, coalesce(m.email, '')
       from public.members m where m.archived_at is null and m.full_name ilike v_like limit p_limit)
    union all
    (select 'client'::text, c.id, c.name, coalesce(c.address, '')
       from public.clients c where c.name ilike v_like or c.address ilike v_like limit p_limit)
    union all
    (select 'request'::text, r.id, r.title, r.status
       from public.task_requests r where r.title ilike v_like limit p_limit);
end $$;
revoke all on function public.search_all(text, integer) from public, anon;
grant execute on function public.search_all(text, integer) to authenticated;
