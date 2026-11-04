\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
select public.create_demo_firm() is not null; select public.switch_firm('demo');
select 'demo with clients', count(*) from clients;
select 'demo link', count(*) from task_links;
select public.switch_firm('own');
insert into invites (firm_id) select firm_id from members where user_id=auth.uid() and not is_demo;
reset role; create temp table tok as select token from invites where firm_id in (select id from firms where name='A'); grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select public.accept_invite((select token from tok),'Emil') is not null;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
insert into clients (firm_id, name) select firm_id, 'Kunde X' from members where user_id=auth.uid() and not is_demo;
insert into tasks (firm_id,title,assignee_id,client_id) select m.firm_id,'T',(select id from members where full_name='Emil'),(select id from clients where name='Kunde X') from members m where m.user_id=auth.uid() and not m.is_demo;
insert into task_links (task_id) select id from tasks where title='T';
select 'link token length', length(token) from task_links where task_id=(select id from tasks where title='T');
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees clients', count(*) from clients; select 'emp sees links', count(*) from task_links; select 'emp sees inbound', count(*) from inbound_requests;
update tasks set client_id = null;  -- muss scheitern
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','Bernd') is not null;
select 'B sees A clients/links', (select count(*) from clients where name='Kunde X'), (select count(*) from task_links);
reset role; create temp table cx as select id from clients where name='Kunde X'; grant select on cx to authenticated; set role authenticated; select pg_temp.u('b0000000-0000-0000-0000-00000000000b');
select 'B task with A client (muss scheitern)'; insert into tasks (firm_id,title,client_id) select firm_id,'X',(select id from cx) from members where user_id=auth.uid();
set role anon; select 'anon links', count(*) from task_links;
