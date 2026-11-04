-- =====================================================================
-- Demo-Firma (Sandbox) pro Nutzer: realistische Daten in allen Status.
-- Erzeugt beim ersten Login als Chef (App ruft create_demo_firm()).
-- Spätere Etappen erweitern private.seed_demo_firm (Kunden, Ausgaben, Schichten …).
-- =====================================================================

create or replace function private.seed_demo_firm(p_firm uuid, p_boss uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'Europe/Berlin')::date;
  e1 uuid; e2 uuid; e3 uuid;
  t uuid;
  g1 uuid; g2 uuid;
begin
  insert into public.groups (firm_id, name) values (p_firm, 'Reinigung') returning id into g1;
  insert into public.groups (firm_id, name) values (p_firm, 'Bau & Renovierung') returning id into g2;

  insert into public.members (firm_id, role, full_name, email, group_id, pay_mode, hourly_rate_cents, is_demo)
    values (p_firm, 'employee', 'Dmitri Iwanow', 'dmitri@demo.invalid', g1, 'hourly', 1800, true) returning id into e1;
  insert into public.members (firm_id, role, full_name, email, group_id, pay_mode, hourly_rate_cents, is_demo)
    values (p_firm, 'employee', 'Lukas Weber', 'lukas@demo.invalid', g2, 'both', 1500, true) returning id into e2;
  insert into public.members (firm_id, role, full_name, email, group_id, pay_mode, status, is_demo)
    values (p_firm, 'employee', 'Olga Petrowa', 'olga@demo.invalid', g1, 'fixed', 'active', true) returning id into e3;

  -- in Arbeit, mit laufendem Timer
  insert into public.tasks (firm_id, title, description, address, assignee_id, due_date, due_time, status, created_by)
    values (p_firm, 'Treppenhaus reinigen – Haus A', 'Alle Etagen wischen, Geländer abwischen.', 'Karl-Marx-Allee 12, 10243 Berlin',
            e1, d, '09:00', 'in_progress', p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 12000);
  insert into public.checklist_items (task_id, text, done, position) values
    (t, 'Erdgeschoss', true, 0), (t, '1.–3. OG', true, 1), (t, '4.–5. OG', false, 2), (t, 'Geländer', false, 3);
  insert into public.time_entries (task_id, member_id, started_at) values (t, e1, now() - interval '50 minutes');

  -- neu, dringend
  insert into public.tasks (firm_id, title, description, address, assignee_id, due_date, due_time, priority, created_by)
    values (p_firm, 'Büro Fenster 2. OG', 'Kunde kommt um 16 Uhr – vorher fertig.', 'Friedrichstr. 88, 10117 Berlin',
            e1, d, '13:00', 'urgent', p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 9000);
  insert into public.checklist_items (task_id, text, position) values (t, 'Innen', 0), (t, 'Außen', 1), (t, 'Rahmen', 2);
  insert into public.task_comments (task_id, author_id, author_name, body)
    select t, p_boss, full_name, 'Schlüssel liegt beim Hausmeister.' from public.members where id = p_boss;

  -- zur Prüfung
  insert into public.tasks (firm_id, title, address, assignee_id, due_date, status, priority, fixed_pay_cents, created_by)
    values (p_firm, 'Badfliesen verfugen', 'Hermannstr. 3, 12049 Berlin', e2, d - 1, 'review', 'urgent', 9000, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 22000);
  insert into public.time_entries (task_id, member_id, started_at, ended_at) values (t, e2, now() - interval '26 hours', now() - interval '23 hours');

  -- Nacharbeit
  insert into public.tasks (firm_id, title, address, assignee_id, due_date, status, created_by)
    values (p_firm, 'Grundreinigung Praxis Dr. Klein', 'Schönhauser Allee 40, 10435 Berlin', e1, d - 2, 'review', p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 25000);
  update public.tasks set status = 'rework' where id = t;
  insert into public.task_comments (task_id, author_id, author_name, body)
    select t, p_boss, full_name, 'Bitte die Fensterbänke im Wartezimmer nochmal – da sind noch Streifen.' from public.members where id = p_boss;

  -- neu, später
  insert into public.tasks (firm_id, title, description, address, assignee_id, due_date, fixed_pay_cents, created_by)
    values (p_firm, 'Trockenbauwand Küche stellen', 'Material liegt im Keller.', 'Sonnenallee 150, 12059 Berlin', e2, d + 1, 18000, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 42000);
  insert into public.tasks (firm_id, title, assignee_id, due_date, fixed_pay_cents, created_by)
    values (p_firm, 'Lager-Inventur Regal A–F', e2, d + 3, 6000, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 15000);
  insert into public.tasks (firm_id, title, description, address, due_date, created_by)
    values (p_firm, 'Teppichreinigung Hotel Lobby', 'Noch niemandem zugewiesen.', 'Unter den Linden 77, 10117 Berlin', d + 5, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 30000);

  -- erledigt & abgenommen
  insert into public.tasks (firm_id, title, address, assignee_id, due_date, status, created_by)
    values (p_firm, 'Treppenhaus reinigen – Haus B', 'Karl-Marx-Allee 14, 10243 Berlin', e1, d, 'review', p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 12000);
  insert into public.time_entries (task_id, member_id, started_at, ended_at) values (t, e1, now() - interval '5 hours', now() - interval '2 hours');
  update public.tasks set status = 'done', accepted_by = p_boss, rating = 5 where id = t;

  insert into public.tasks (firm_id, title, assignee_id, due_date, status, fixed_pay_cents, created_by)
    values (p_firm, 'Malerarbeiten Flur', e2, d, 'review', 25000, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 52000);
  insert into public.time_entries (task_id, member_id, started_at, ended_at) values (t, e2, now() - interval '7 hours', now() - interval '1 hour');
  update public.tasks set status = 'done', accepted_by = p_boss, rating = 4 where id = t;

  insert into public.tasks (firm_id, title, assignee_id, due_date, status, fixed_pay_cents, created_by)
    values (p_firm, 'Fensterreinigung Kita Sonnenschein', e3, d - 4, 'review', 7000, p_boss) returning id into t;
  insert into public.task_finance (task_id, client_price_cents) values (t, 16000);
  update public.tasks set status = 'done', accepted_by = p_boss, rating = 5 where id = t;

  -- Anfragen & Vorlage
  insert into public.task_requests (firm_id, created_by, title, description, address, due_date) values
    (p_firm, e1, 'Mülltonnenplatz Haus A säubern', 'Dort liegt seit Tagen Sperrmüll.', 'Karl-Marx-Allee 12, 10243 Berlin', d + 2),
    (p_firm, e2, 'Silikonfugen Dusche erneuern', null, 'Hermannstr. 3, 12049 Berlin', null);
  insert into public.task_templates (firm_id, title, address, assignee_id, recurrence, weekdays, client_price_cents, checklist, last_run_on)
    values (p_firm, 'Treppenhaus reinigen – Haus A', 'Karl-Marx-Allee 12, 10243 Berlin', e1, 'weekly', '{1,4}', 12000,
            '{"Erdgeschoss","1.–3. OG","4.–5. OG","Geländer"}', d);
  insert into public.task_statuses (firm_id, name, color, position, kind) values (p_firm, 'Material fehlt', 'violet', 5, 'in_progress');
end $$;

-- Demo-Firma anlegen (idempotent). Nur für Nutzer mit eigener Firma als Chef.
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
  return v_firm;
end $$;

-- Demo zurücksetzen: komplett löschen und neu anlegen, danach in die Demo wechseln
create or replace function public.reset_demo_firm()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_firm uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select m.firm_id into v_firm from public.members m join public.firms f on f.id = m.firm_id
  where m.user_id = v_uid and m.is_demo and f.is_demo;
  if v_firm is not null then
    delete from public.firms where id = v_firm and is_demo;
  end if;
  v_firm := public.create_demo_firm();
  perform public.switch_firm('demo');
  return v_firm;
end $$;

revoke all on function public.create_demo_firm() from public, anon;
revoke all on function public.reset_demo_firm() from public, anon;
grant execute on function public.create_demo_firm() to authenticated;
grant execute on function public.reset_demo_firm() to authenticated;
