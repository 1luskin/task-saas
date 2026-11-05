\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('e2000000-0000-0000-0000-0000000000e2','e2@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de'),('e3000000-0000-0000-0000-0000000000e3','e3@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select public.accept_invite((select token from tok),'Emil') is not null;
select pg_temp.u('e2000000-0000-0000-0000-0000000000e2'); select public.accept_invite((select token from tok),'Erik') is not null;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
insert into shift_plans (firm_id, member_id, date, start_time, end_time) select firm_id, (select id from members where full_name='Emil'), current_date + 1, '07:00', '15:00' from members where user_id=auth.uid();
-- Urlaub genehmigt → Zuweisung blockiert
insert into vacation_requests (firm_id, member_id, date_from, date_to, days, status) select firm_id, (select id from members where full_name='Erik'), current_date+3, current_date+5, 3, 'approved' from members where user_id=auth.uid();
select 'assign during vacation (muss scheitern)'; insert into tasks (firm_id,title,assignee_id,due_date) select firm_id,'X',(select id from members where full_name='Erik'), current_date+4 from members where user_id=auth.uid();
insert into tasks (firm_id,title,assignee_id,due_date) select firm_id,'Y',(select id from members where full_name='Erik'), current_date+7 from members where user_id=auth.uid();
select 'assign after vacation ok', count(*) from tasks where title='Y';
insert into announcements (firm_id, title, body) select firm_id, 'Info', 'Betriebsfeier Freitag' from members where user_id=auth.uid();
-- Mitarbeiter Emil
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'colleagues', string_agg(full_name, ',' order by full_name) from public.colleagues();
select 'own plan', count(*) from shift_plans;
insert into shift_swaps (firm_id, plan_id, from_member, to_member) select firm_id, (select id from shift_plans limit 1), id, (select id from public.colleagues() where full_name='Erik') from members where user_id=auth.uid();
select 'swap created', status from shift_swaps;
select 'self-approve (muss scheitern)'; select public.decide_swap((select id from shift_swaps), 'approve');
insert into announcement_reads (announcement_id, member_id) select (select id from announcements), id from members where user_id=auth.uid();
insert into vacation_requests (firm_id, member_id, date_from, date_to, days) select firm_id, id, current_date+10, current_date+11, 2 from members where user_id=auth.uid();
update vacation_requests set status='approved'; select 'emp self-approve vacation', count(*) from vacation_requests where status='approved';
select 'emp sees Erik vacation', count(*) from vacation_requests where member_id <> (select id from members where user_id=auth.uid());
insert into daily_reports (firm_id, member_id, date, done_text) select firm_id, id, current_date, 'Treppenhaus fertig' from members where user_id=auth.uid();
select 'emp sees docs of others', count(*) from member_documents;
-- Erik akzeptiert, Chef genehmigt
select pg_temp.u('e2000000-0000-0000-0000-0000000000e2');
select public.decide_swap((select id from shift_swaps), 'accept');
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select public.decide_swap((select id from shift_swaps), 'approve');
select 'plan now Erik', (select full_name from members where id = (select member_id from shift_plans limit 1));
select 'read by', count(*) from announcement_reads;
select 'boss sees reports', count(*) from daily_reports;
-- Import: Mitglied ohne Login + persönliche Einladung
insert into members (firm_id, role, full_name) select firm_id, 'employee', 'Importiert Ida' from members where user_id=auth.uid() and not is_demo;
insert into invites (firm_id, member_id, max_uses) select firm_id, (select id from members where full_name='Importiert Ida'), 1 from members where user_id=auth.uid() and not is_demo;
reset role; create temp table tok2 as select token from invites where member_id is not null; grant select on tok2 to authenticated; set role authenticated;
select pg_temp.u('e3000000-0000-0000-0000-0000000000e3'); select 'claimed', public.accept_invite((select token from tok2), '') is not null, (select full_name from members where user_id = auth.uid());
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','B') is not null;
select 'B sees', (select count(*) from shift_plans), (select count(*) from vacation_requests), (select count(*) from announcements), (select count(*) from daily_reports), (select count(*) from public.colleagues());
-- Chef darf kein Mitglied mit fremdem Login anlegen (nur Import ohne user_id)
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'insert member with user_id (muss scheitern)'; insert into members (firm_id, role, full_name, user_id) select firm_id, 'employee', 'Fremd', 'b0000000-0000-0000-0000-00000000000b' from members where user_id=auth.uid() and not is_demo;
-- Mitarbeiter darf Anleitung an der Aufgabe nicht ändern
insert into kb_articles (firm_id, title, body) select firm_id, 'Anleitung', 'Text' from members where user_id=auth.uid() and not is_demo;
update tasks set assignee_id = (select id from members where full_name='Emil') where title='Y';
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees kb', count(*) from kb_articles;
select 'emp set kb_article (muss scheitern)'; update tasks set kb_article_id = (select id from kb_articles limit 1) where title='Y';
select 'flags', count(*) from feature_flags where key in ('team','knowledge');
