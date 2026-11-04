\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select 'firm' , public.create_firm('A','Boss') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select 'join', public.accept_invite((select token from tok),'Emp') is not null;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
insert into tasks (firm_id,title,assignee_id) select firm_id,'T1',(select id from members where full_name='Emp') from members where user_id=auth.uid();
select 'statuses seeded', count(*) from task_statuses;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees statuses', count(*) from task_statuses;
update tasks set status='in_progress'; select 'new->in_progress', status from tasks;
update tasks set status='done';                                       -- muss scheitern
update tasks set status='review'; select 'in_progress->review', status, submitted_at is not null from tasks;
update tasks set status='in_progress';                                -- review->in_progress muss scheitern
delete from task_statuses where kind='new';  select 'emp delete status rows', count(*) from task_statuses;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
update tasks set status='rework'; select 'boss->rework', status, rework_count from tasks;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
update tasks set status='in_progress'; select 'rework->in_progress', status from tasks;
update tasks set status='review';
update tasks set rating=5;                                            -- muss scheitern
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
update tasks set status='done', rating=4; select 'accepted', status, accepted_at is not null, accepted_by is not null, rating, completed_at is not null from tasks;
delete from task_statuses where kind='review' and is_system;          -- muss scheitern
update task_statuses set name='Kontrolle' where kind='review'; select 'renamed', name from task_statuses where kind='review';
insert into task_statuses (firm_id,name,kind,color,position) select firm_id,'Material fehlt','in_progress','amber',5 from members where user_id=auth.uid();
update tasks set custom_status_id=(select id from task_statuses where name='Material fehlt'); select 'custom->stage', status, accepted_at is null from tasks;
-- fremde Firma
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select 'firm B', public.create_firm('B','Bernd') is not null;
select 'B sees A statuses', count(*) from task_statuses where name='Material fehlt';
update tasks set custom_status_id=(select id from task_statuses limit 1);
reset role;
update tasks set custom_status_id=(select id from task_statuses ts where ts.firm_id <> tasks.firm_id limit 1);  -- fremder Status → Fehler
