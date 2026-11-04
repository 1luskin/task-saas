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
insert into tasks (firm_id,title,address,assignee_id) select firm_id,'Fenster Bäckerei Müller','Hauptstraße 5',(select id from members where full_name='Emil') from members where user_id=auth.uid();
insert into tasks (firm_id,title) select firm_id,'Окна склад' from members where user_id=auth.uid();
insert into clients (firm_id,name) select firm_id,'Bäckerei Müller' from members where user_id=auth.uid();
select 'boss search de', string_agg(kind||':'||title, ', ' order by kind) from public.search_all('bäck');
select 'boss search ru', string_agg(title, ', ') from public.search_all('окна');
update tasks set pinned = true where title like 'Fenster%';
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp search (only own task, no client)', string_agg(kind||':'||title, ', ') from public.search_all('bäck');
select 'emp search ru (nothing)', count(*) from public.search_all('окна');
update tasks set pinned = false; -- muss scheitern
update tasks set status = 'in_progress' where title like 'Fenster%';
select 'emp sees activity', count(*) from activity;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'boss activity', string_agg(kind || '/' || (payload->>'to'), ', ') from activity;
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','Bernd') is not null;
select 'B search', count(*) from public.search_all('fenster'); select 'B activity', count(*) from activity;
