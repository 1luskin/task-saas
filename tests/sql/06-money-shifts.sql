\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select public.accept_invite((select token from tok),'Emil') is not null;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
update members set pay_mode='hourly', hourly_rate_cents=2000, hourly_basis='shifts' where full_name='Emil';
insert into tasks (firm_id,title,assignee_id) select firm_id,'T',(select id from members where full_name='Emil') from members where user_id=auth.uid() and not is_demo;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
-- Schicht
insert into shifts (id, firm_id, member_id, started_at) select gen_random_uuid(), firm_id, id, now() - interval '3 hours' from members where user_id=auth.uid();
select 'shift rate (basis shifts)', rate_cents from shifts;
insert into shifts (id, firm_id, member_id, started_at) select gen_random_uuid(), firm_id, id, now() from members where user_id=auth.uid(); -- 2. offene Schicht: muss scheitern
insert into time_entries (task_id, member_id, started_at) select (select id from tasks limit 1), id, now() - interval '1 hour' from members where user_id=auth.uid();
select 'entry rate (basis shifts → 0)', rate_cents from time_entries;
update shifts set break_started_at = now() - interval '30 minutes';
update shifts set break_minutes = 30, break_started_at = null, ended_at = now();
select 'shift closed', ended_at is not null, break_minutes from shifts;
update shifts set ended_at = now() - interval '2 hours';  -- abgeschlossene Schicht ändern: muss scheitern
delete from shifts;  select 'delete silently (rows left)', count(*) from shifts;
-- Ausgabe
insert into expenses (task_id, member_id, amount_cents, description, reimburse) select (select id from tasks limit 1), id, 1250, 'Silikon', true from members where user_id=auth.uid();
select 'expense pending', status from expenses;
update expenses set status='approved';  select 'self-approve blocked', status from expenses;
select 'emp cannot add adjustment (muss scheitern)'; insert into adjustments (firm_id, member_id, amount_cents, reason, effective_date) select firm_id, id, 5000, 'selbst', current_date from members where user_id=auth.uid();
select 'emp edit_time_record (muss scheitern)'; select public.edit_time_record('shift', (select id from shifts), now()-interval '5 hours', now(), 0, 'weil');
-- Chef
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
update expenses set status='approved', decided_at=now(); select 'boss approved', status from expenses;
insert into adjustments (firm_id, member_id, amount_cents, reason, effective_date) select firm_id, (select id from members where full_name='Emil'), 5000, 'Sonntagszuschlag', current_date from members where user_id=auth.uid() and not is_demo;
select 'adjustment', amount_cents from adjustments;
update shifts set ended_at = now() - interval '1 hour'; -- direkt: muss scheitern
select 'no reason (muss scheitern)'; select public.edit_time_record('shift', (select id from shifts), now()-interval '4 hours', now()-interval '1 hour', 15, '');
select public.edit_time_record('shift', (select id from shifts), now()-interval '4 hours', now()-interval '1 hour', 15, 'Vergessen auszustempeln');
select 'history', count(*), min(reason) from time_edits;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees own history', count(*) from time_edits;
-- fremde Firma
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','Bernd') is not null;
select 'B sees shifts/expenses/adjustments/edits', (select count(*) from shifts), (select count(*) from expenses), (select count(*) from adjustments), (select count(*) from time_edits);
select 'B edit A shift (muss scheitern)'; reset role; create temp table sid as select id from shifts; grant select on sid to authenticated; set role authenticated; select pg_temp.u('b0000000-0000-0000-0000-00000000000b');
select public.edit_time_record('shift', (select id from sid), now()-interval '9 hours', now(), 0, 'Hack');
