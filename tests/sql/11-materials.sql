-- Etappe 15: Material (RPC, Bestand, Ausgabe, Rechte), Buchhaltungs-Einstellungen
\set ON_ERROR_STOP 0
\pset tuples_only on
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select public.accept_invite((select token from tok),'Emil') is not null;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
insert into materials (firm_id, name, unit, stock, min_stock, unit_cost_cents) select firm_id, 'Mörtel', 'Sack', 5, 3, 1190 from members where user_id=auth.uid();
insert into tasks (firm_id, title, assignee_id) select firm_id, 'T1', (select id from members where full_name='Emil') from members where user_id=auth.uid();
insert into tasks (firm_id, title) select firm_id, 'T2 fremd' from members where user_id=auth.uid();
update firms set datev_consultant_no = 12345, datev_client_no = 678, datev_skr = '04', vat_rate = 7;
select 'firm settings', datev_skr, vat_rate from firms;
-- Mitarbeiter
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees materials', count(*) from materials;
select 'emp update stock (0 rows)'; update materials set stock = 999;
select 'use 2 → low first', * from public.use_material((select id from materials), (select id from tasks where title='T1'), 2);
select 'use 1 → low (not first)', * from public.use_material((select id from materials), (select id from tasks where title='T1'), 1);
select 'use 1 → low again (not first)', * from public.use_material((select id from materials), (select id from tasks where title='T1'), 1);
select 'too much (muss scheitern)'; select * from public.use_material((select id from materials), (select id from tasks where title='T1'), 5);
select 'foreign task (muss scheitern)'; select * from public.use_material((select id from materials), (select id from tasks where title='T2 fremd' union select '00000000-0000-0000-0000-000000000000'::uuid limit 1), 1);
select 'emp expenses', count(*), sum(amount_cents), min(status), min(source) from expenses;
select 'emp moves', count(*) from material_moves;
select 'emp restock (muss scheitern)'; select public.adjust_material_stock((select id from materials), 10, 'in');
-- Chef: Zugang setzt Warnung zurück
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'restock', public.adjust_material_stock((select id from materials), 10, 'in', 1250, 'Lieferung');
select 'after restock', stock, unit_cost_cents, low_notified_at is null from materials;
select 'boss moves', count(*) from material_moves;
-- Fremde Firma
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','B') is not null;
select 'B sees', (select count(*) from materials), (select count(*) from material_moves);
select 'B uses A material (muss scheitern)'; select * from public.use_material((select id from materials limit 1), (select id from tasks limit 1), 1);
