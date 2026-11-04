\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('c0000000-0000-0000-0000-00000000000c','c@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'firm', public.create_firm('A GmbH','Anna') is not null;
select 'second real firm (muss scheitern)'; select public.create_firm('A2','Anna');
select 'demo created', public.create_demo_firm() is not null;
select 'demo idempotent', public.create_demo_firm() = public.create_demo_firm();
select 'ctx own', (select f.name from members m join firms f on f.id=m.firm_id where m.id=(select member_id from public.current_context()));
select 'sees only own firm tasks', count(*) from tasks;
select public.switch_firm('demo');
select 'ctx demo', (select f.name from members m join firms f on f.id=m.firm_id where m.id=(select member_id from public.current_context()));
select 'demo tasks', count(*), count(*) filter (where status='review'), count(*) filter (where status='rework'), count(*) filter (where status='done' and accepted_at is not null) from tasks;
select 'demo statuses', count(*) from task_statuses;
-- als Mitarbeiter ansehen
select public.set_acting((select id from members where full_name='Dmitri Iwanow'));
select 'acting', acting from public.current_context();
select 'acting sees own tasks only', count(*) from tasks;
select 'acting finance', count(*) from task_finance;
update tasks set status='done' where title='Büro Fenster 2. OG';  -- muss scheitern
update tasks set status='in_progress' where title='Büro Fenster 2. OG';
select 'acting started', status from tasks where title='Büro Fenster 2. OG';
select public.set_acting(null);
select 'back to boss', acting, (select count(*) from tasks) from public.current_context();
-- acting in echter Firma verboten
select public.switch_firm('own');
reset role; create temp table x as select id from members where full_name='Anna' and not is_demo; grant select on x to authenticated; set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
-- Mitarbeiter in echter Firma anlegen (nur via invite) → acting auf echten Mitarbeiter verboten
insert into invites (firm_id) select firm_id from members where id=(select member_id from public.current_context());
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select 'emp joined', public.accept_invite((select token from tok),'Emil') is not null;
select 'emp no demo (muss scheitern)'; select public.create_demo_firm();
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'acting real firm (muss scheitern)'; select public.set_acting((select id from members where full_name='Emil'));
-- Testzeitraum abgelaufen
reset role; select set_config('request.jwt.claim.sub', '', false); update firms set trial_ends_at = now() - interval '1 day' where name='A GmbH'; set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'expired: insert (muss scheitern)'; insert into tasks (firm_id,title) select firm_id,'nach Trial' from members where id=(select member_id from public.current_context());
select 'expired: read ok', count(*) >= 0 from tasks;
select 'expired: update ok'; update firms set name='A GmbH 2' where id=(select firm_id from members where id=(select member_id from public.current_context()));
select 'boss cannot extend trial (muss scheitern)'; update firms set trial_ends_at = now() + interval '1 year';
select 'demo still writable'; select public.switch_firm('demo');
insert into tasks (firm_id,title) select firm_id,'in demo' from members where id=(select member_id from public.current_context());
select 'demo insert ok', count(*) from tasks where title='in demo';
-- fremder Nutzer sieht nichts
select pg_temp.u('c0000000-0000-0000-0000-00000000000c');
select 'stranger tasks', count(*) from tasks; select 'stranger set_acting (muss scheitern)'; select public.set_acting((select id from members limit 1));
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'reset demo', public.reset_demo_firm() is not null, (select count(*) from tasks where title='in demo');
