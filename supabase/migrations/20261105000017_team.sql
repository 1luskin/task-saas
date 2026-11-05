-- =====================================================================
-- Etappe 14: Team – Dienstplan + Schichttausch, Urlaubsanträge (Kontingent,
-- blockiert Zuweisung), Schwarzes Brett mit Lesebestätigung, Tagesbericht,
-- eigene Formulare, Dokumente mit Ablaufdatum, Wissensdatenbank, Import.
-- =====================================================================

-- Kollegen (nur Name) – Mitarbeiter sehen sonst keine anderen Mitglieder
create or replace function public.colleagues()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.full_name from public.members m
  where m.firm_id = private.my_firm_id() and m.archived_at is null and m.id <> coalesce(private.my_member_id(), '00000000-0000-0000-0000-000000000000')
  order by m.full_name
$$;
grant execute on function public.colleagues() to authenticated;

-- Gehört das Mitglied (aktiv) zur eigenen Firma? (umgeht die Sichtbarkeits-RLS von members gezielt)
create or replace function private.member_in_my_firm(p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.id = p_member and m.firm_id = private.my_firm_id() and m.archived_at is null)
$$;
grant execute on function private.member_in_my_firm(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dienstplan
-- ---------------------------------------------------------------------
create table public.shift_plans (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  date       date not null,
  start_time time not null,
  end_time   time not null,
  note       text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index shift_plans_firm_date on public.shift_plans(firm_id, date);
alter table public.shift_plans enable row level security;
create policy shift_plans_select on public.shift_plans for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy shift_plans_boss on public.shift_plans for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.member_in_my_firm(member_id));

create table public.shift_swaps (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  plan_id     uuid not null references public.shift_plans(id) on delete cascade,
  from_member uuid not null references public.members(id) on delete cascade,
  to_member   uuid not null references public.members(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
alter table public.shift_swaps enable row level security;
create policy swaps_select on public.shift_swaps for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or from_member = private.my_member_id() or to_member = private.my_member_id()));
create policy swaps_insert on public.shift_swaps for insert to authenticated
  with check (firm_id = private.my_firm_id() and from_member = private.my_member_id() and status = 'pending'
              and exists (select 1 from public.shift_plans p where p.id = plan_id and p.member_id = private.my_member_id())
              and private.member_in_my_firm(to_member));
-- Statuswechsel nur über RPC decide_swap (Kollege akzeptiert, Chef genehmigt)

create or replace function public.decide_swap(p_swap uuid, p_action text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.shift_swaps%rowtype;
begin
  select * into v from public.shift_swaps where id = p_swap and firm_id = private.my_firm_id() for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if p_action = 'accept' and v.status = 'pending' and v.to_member = private.my_member_id() then
    update public.shift_swaps set status = 'accepted' where id = v.id;
  elsif p_action = 'approve' and v.status = 'accepted' and private.is_boss() then
    update public.shift_plans set member_id = v.to_member where id = v.plan_id;
    update public.shift_swaps set status = 'approved', decided_at = now() where id = v.id;
  elsif p_action = 'reject' and v.status in ('pending', 'accepted')
        and (private.is_boss() or v.to_member = private.my_member_id() or v.from_member = private.my_member_id()) then
    update public.shift_swaps set status = 'rejected', decided_at = now() where id = v.id;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;
revoke all on function public.decide_swap(uuid, text) from public, anon;
grant execute on function public.decide_swap(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Urlaub: Anträge, Jahreskontingent, Blockade der Zuweisung
-- ---------------------------------------------------------------------
alter table public.members add column vacation_days_per_year smallint not null default 24 check (vacation_days_per_year between 0 and 60);

create table public.vacation_requests (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  date_from  date not null,
  date_to    date not null check (date_to >= date_from),
  days       smallint not null check (days between 1 and 366),
  note       text check (note is null or char_length(note) <= 500),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.members(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index vacation_member_idx on public.vacation_requests(member_id, date_from);
alter table public.vacation_requests enable row level security;
create policy vacation_select on public.vacation_requests for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy vacation_insert on public.vacation_requests for insert to authenticated
  with check (firm_id = private.my_firm_id() and member_id = private.my_member_id() and status = 'pending');
create policy vacation_insert_boss on public.vacation_requests for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.member_in_my_firm(member_id));
create policy vacation_update_boss on public.vacation_requests for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy vacation_delete_own on public.vacation_requests for delete to authenticated
  using (firm_id = private.my_firm_id() and member_id = private.my_member_id() and status = 'pending');

-- genehmigter Urlaub am Fälligkeitstag → Zuweisung blockiert
create or replace function private.guard_task_vacation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Anleitung an der Aufgabe setzt nur der Chef
  if tg_op = 'UPDATE' and auth.uid() is not null and not private.is_boss()
     and new.kb_article_id is distinct from old.kb_article_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new.assignee_id is not null and new.due_date is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id or new.due_date is distinct from old.due_date)
     and exists (select 1 from public.vacation_requests v where v.member_id = new.assignee_id and v.status = 'approved'
                 and new.due_date between v.date_from and v.date_to) then
    raise exception 'assignee unavailable' using errcode = '23514', hint = 'member_unavailable';
  end if;
  return new;
end $$;
create trigger tasks_vacation_guard before insert or update on public.tasks
  for each row execute function private.guard_task_vacation();

-- ---------------------------------------------------------------------
-- Schwarzes Brett
-- ---------------------------------------------------------------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete cascade, -- null = alle
  title      text not null check (char_length(title) between 1 and 160),
  body       text not null check (char_length(body) between 1 and 5000),
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_firm_idx on public.announcements(firm_id, created_at desc);
alter table public.announcements enable row level security;
create policy announcements_select on public.announcements for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or group_id is null
         or group_id = (select m.group_id from public.members m where m.id = private.my_member_id())));
create policy announcements_boss on public.announcements for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, member_id)
);
alter table public.announcement_reads enable row level security;
create policy reads_select on public.announcement_reads for select to authenticated
  using (member_id = private.my_member_id() or (private.is_boss()
         and exists (select 1 from public.announcements a where a.id = announcement_id and a.firm_id = private.my_firm_id())));
create policy reads_insert on public.announcement_reads for insert to authenticated
  with check (member_id = private.my_member_id()
              and exists (select 1 from public.announcements a where a.id = announcement_id and a.firm_id = private.my_firm_id()));

-- ---------------------------------------------------------------------
-- Tagesbericht (Bautagebuch)
-- ---------------------------------------------------------------------
create table public.daily_reports (
  id         uuid primary key default gen_random_uuid(), -- vom Client (offline, idempotent)
  firm_id    uuid not null references public.firms(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  date       date not null,
  task_id    uuid references public.tasks(id) on delete set null,
  done_text  text not null check (char_length(done_text) between 1 and 5000),
  problems   text check (problems is null or char_length(problems) <= 3000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index daily_reports_firm_idx on public.daily_reports(firm_id, date desc);
alter table public.daily_reports enable row level security;
create policy reports_select on public.daily_reports for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy reports_insert on public.daily_reports for insert to authenticated
  with check (firm_id = private.my_firm_id() and member_id = private.my_member_id() and private.firm_can_write(firm_id)
              and (task_id is null or private.can_see_task(task_id)));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
-- Pfad {firm_id}/{member_id}/{uuid}.jpg – eigener Ordner oder Chef
create or replace function private.can_access_member_path(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(p_name))[1] = private.my_firm_id()::text
     and (private.is_boss() or (storage.foldername(p_name))[2] = private.my_member_id()::text)
$$;
grant execute on function private.can_access_member_path(text) to authenticated;
create policy report_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and private.can_access_member_path(name));
create policy report_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and private.can_access_member_path(name)
              and (storage.foldername(name))[2] = private.my_member_id()::text);

-- ---------------------------------------------------------------------
-- Eigene Formulare (z. B. Abnahmeprotokoll) – ohne Unterschrift
-- ---------------------------------------------------------------------
create table public.form_templates (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  fields     jsonb not null default '[]'::jsonb, -- [{id,type:text|number|checkbox|select|photo,label,options[]}]
  created_at timestamptz not null default now()
);
alter table public.form_templates enable row level security;
create policy form_templates_select on public.form_templates for select to authenticated
  using (firm_id = private.my_firm_id());
create policy form_templates_boss on public.form_templates for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

create table public.form_submissions (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  template_id  uuid not null references public.form_templates(id) on delete cascade,
  values       jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.form_submissions enable row level security;
create trigger form_submissions_firm before insert on public.form_submissions
  for each row execute function private.inherit_task_firm();
create policy form_sub_select on public.form_submissions for select to authenticated
  using (private.can_see_task(task_id));
create policy form_sub_insert on public.form_submissions for insert to authenticated
  with check (private.can_see_task(task_id) and submitted_by = private.my_member_id() and private.firm_can_write(private.my_firm_id()));

-- ---------------------------------------------------------------------
-- Dokumente der Mitarbeiter (Führerschein, Zertifikate) mit Ablauf
-- ---------------------------------------------------------------------
create table public.member_documents (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  expires_on   date,
  file_path    text,
  reminded_at  timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.member_documents enable row level security;
create policy docs_select on public.member_documents for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy docs_boss on public.member_documents for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.member_in_my_firm(member_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-docs', 'member-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy member_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'member-docs' and private.can_access_member_path(name));
create policy member_docs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'member-docs' and private.is_boss() and (storage.foldername(name))[1] = private.my_firm_id()::text);
create policy member_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'member-docs' and private.is_boss() and (storage.foldername(name))[1] = private.my_firm_id()::text);

-- ---------------------------------------------------------------------
-- Wissensdatenbank (an Vorlagen anhängbar)
-- ---------------------------------------------------------------------
create table public.kb_articles (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 160),
  body       text not null check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.kb_articles enable row level security;
create policy kb_select on public.kb_articles for select to authenticated using (firm_id = private.my_firm_id());
create policy kb_boss on public.kb_articles for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
alter table public.task_templates add column kb_article_id uuid references public.kb_articles(id) on delete set null;
alter table public.tasks add column kb_article_id uuid references public.kb_articles(id) on delete set null;

-- ---------------------------------------------------------------------
-- Import: Mitglied ohne Login anlegen und per persönlichem Einladungslink verbinden
-- ---------------------------------------------------------------------
alter table public.invites add column member_id uuid references public.members(id) on delete cascade;

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
  if exists (select 1 from public.members where user_id = v_uid and not is_demo) then
    raise exception 'already member' using errcode = '23505';
  end if;
  select * into v_inv from public.invites where token = p_token for update;
  if not found or v_inv.revoked or v_inv.expires_at <= now() or v_inv.used_count >= v_inv.max_uses
     or not private.firm_can_write(v_inv.firm_id) then
    raise exception 'invite invalid' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = v_uid;

  if v_inv.member_id is not null then
    -- persönliche Einladung (Import): vorhandenes Mitglied übernehmen (Guard für diese Übernahme freischalten)
    perform set_config('app.claim', '1', true);
    update public.members set user_id = v_uid, email = coalesce(email, v_email),
      locale = case when p_locale in ('de', 'ru') then p_locale else locale end
    where id = v_inv.member_id and user_id is null and archived_at is null
    returning id into v_member;
    if v_member is null then
      raise exception 'invite invalid' using errcode = '22023';
    end if;
    perform set_config('app.claim', '', true);
    update public.invites set used_count = max_uses where id = v_inv.id; -- nur einmal nutzbar
  else
    if char_length(trim(coalesce(p_full_name, ''))) = 0 then
      raise exception 'invalid input' using errcode = '22023';
    end if;
    insert into public.members (firm_id, user_id, role, full_name, email, group_id, locale)
    values (v_inv.firm_id, v_uid, v_inv.role, trim(p_full_name), v_email, v_inv.group_id,
            case when p_locale in ('de', 'ru') then p_locale else 'de' end)
    returning id into v_member;
    update public.invites set used_count = used_count + 1 where id = v_inv.id;
  end if;

  insert into public.user_settings (user_id, active_member_id) values (v_uid, v_member)
  on conflict (user_id) do update set active_member_id = excluded.active_member_id, acting_member_id = null, updated_at = now();
  return v_member;
end $$;

-- Guard Mitglieder: Übernahme per persönlicher Einladung (app.claim) erlauben; Urlaubskontingent nur Chef
create or replace function private.guard_member_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('app.claim', true), '') = '1' and old.user_id is null then
    return new;
  end if;
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
     or new.vacation_days_per_year is distinct from old.vacation_days_per_year
     or new.archived_at is distinct from old.archived_at
     or new.email is distinct from old.email
     or new.is_demo is distinct from old.is_demo then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;

-- Feature-Flags der Etappe
insert into public.feature_flags (key, default_enabled, description) values
  ('team',      true, 'Team: Dienstplan, Urlaub, Schwarzes Brett, Tagesberichte, Dokumente'),
  ('knowledge', true, 'Anleitungen & Formulare')
on conflict (key) do nothing;

-- Chef legt Mitglieder nur ohne Login an (Import); Verknüpfung mit Konto nur über accept_invite
drop policy members_insert_boss on public.members;
create policy members_insert_boss on public.members for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id) and user_id is null);

-- ---------------------------------------------------------------------
-- Demo-Firma: Team-Daten (Dienstplan, Urlaub, Brett, Bericht, Formular, Dokument, Anleitung)
-- ---------------------------------------------------------------------
create or replace function private.seed_demo_team(p_firm uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e1 uuid; e2 uuid; e3 uuid; v_boss uuid; kb uuid; a uuid;
  d date := (now() at time zone 'Europe/Berlin')::date;
begin
  select id into e1 from public.members where firm_id = p_firm and full_name = 'Dmitri Iwanow';
  select id into e2 from public.members where firm_id = p_firm and full_name = 'Lukas Weber';
  select id into e3 from public.members where firm_id = p_firm and full_name = 'Olga Petrowa';
  select id into v_boss from public.members where firm_id = p_firm and role = 'boss' limit 1;
  if e1 is null or e2 is null or e3 is null then return; end if;
  insert into public.shift_plans (firm_id, member_id, date, start_time, end_time)
    select p_firm, m, d + g, s, e
    from generate_series(0, 4) g,
         (values (e1, time '07:00', time '15:00'), (e2, time '08:00', time '16:30')) v(m, s, e);
  insert into public.vacation_requests (firm_id, member_id, date_from, date_to, days, status, decided_by, decided_at)
    values (p_firm, e3, d - 2, d + 6, 7, 'approved', v_boss, now());
  insert into public.vacation_requests (firm_id, member_id, date_from, date_to, days, note)
    values (p_firm, e1, d + 20, d + 24, 5, 'Familienbesuch');
  insert into public.announcements (firm_id, title, body, created_by)
    values (p_firm, 'Neue Arbeitskleidung', 'Ab Montag liegen die neuen Jacken im Lager. Bitte bis Freitag abholen.', v_boss) returning id into a;
  insert into public.announcement_reads (announcement_id, member_id) values (a, e2);
  insert into public.daily_reports (firm_id, member_id, date, done_text, problems)
    values (p_firm, e2, d - 1, 'Alte Fugen entfernt, Bad vorbereitet.', 'Fugenmörtel fehlt – 2 Säcke gekauft.');
  insert into public.form_templates (firm_id, name, fields) values (p_firm, 'Abnahmeprotokoll', jsonb_build_array(
    jsonb_build_object('id', 'f1', 'type', 'checkbox', 'label', 'Arbeitsbereich sauber hinterlassen'),
    jsonb_build_object('id', 'f2', 'type', 'select', 'label', 'Zustand', 'options', jsonb_build_array('Sehr gut', 'Gut', 'Mängel')),
    jsonb_build_object('id', 'f3', 'type', 'number', 'label', 'Verbrauchte Stunden'),
    jsonb_build_object('id', 'f4', 'type', 'text', 'label', 'Bemerkungen')));
  insert into public.member_documents (firm_id, member_id, name, expires_on) values
    (p_firm, e2, 'Führerschein Klasse B', d + 21), (p_firm, e1, 'Erste-Hilfe-Kurs', d + 200);
  insert into public.kb_articles (firm_id, title, body) values (p_firm, 'Treppenhausreinigung – Standard',
    E'1. Von oben nach unten arbeiten.\n2. Geländer mit Desinfektionsmittel.\n3. Briefkästen nicht nass wischen.\n4. Fotos vorher/nachher machen.') returning id into kb;
  update public.tasks set kb_article_id = kb where firm_id = p_firm and title like 'Treppenhaus%';
  update public.task_templates set kb_article_id = kb where firm_id = p_firm and title like 'Treppenhaus%';
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
  return v_firm;
end $$;
