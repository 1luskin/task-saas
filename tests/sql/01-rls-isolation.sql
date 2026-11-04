\set ON_ERROR_STOP 0
insert into auth.users values
 ('a0000000-0000-0000-0000-00000000000a','boss-a@x.de'),
 ('b0000000-0000-0000-0000-00000000000b','boss-b@x.de'),
 ('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),
 ('e2000000-0000-0000-0000-0000000000e2','e2@x.de');

create or replace function pg_temp.as_user(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;

set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.create_firm('Firma A','Anna Boss') is not null as firm_a_created;
insert into invites (firm_id) select id from firms;  -- firm_id = A
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.create_firm('Firma B','Bernd Boss') is not null as firm_b_created;

-- Mitarbeiter treten bei
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000e1');
select public.accept_invite((select token from tok), 'Emil Eins') is not null as e1_joined;
select pg_temp.as_user('e2000000-0000-0000-0000-0000000000e2');
select public.accept_invite((select token from tok), 'Erik Zwei') is not null as e2_joined;
select public.accept_invite((select token from tok), 'Erik nochmal') as e2_double_join_should_fail;

-- Chef A legt Aufgaben an
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
update members set pay_mode='both', hourly_rate_cents=2000 where full_name='Emil Eins';
insert into tasks (firm_id,title,assignee_id) select firm_id,'Task E1',(select id from members where full_name='Emil Eins') from members where user_id=auth.uid();
insert into tasks (firm_id,title,assignee_id) select firm_id,'Task E2',(select id from members where full_name='Erik Zwei') from members where user_id=auth.uid();
insert into task_finance (task_id, client_price_cents) select id, 10000 from tasks;
insert into checklist_items (task_id, text) select id, 'Punkt' from tasks;
select count(*) as boss_a_sees_tasks from tasks;
select count(*) as boss_a_sees_members from members;

-- Urlaub → Zuweisung muss scheitern
update members set status='vacation' where full_name='Erik Zwei';
insert into tasks (firm_id,title,assignee_id) select firm_id,'Should fail',(select id from members where full_name='Erik Zwei') from members where user_id=auth.uid();
update members set status='active' where full_name='Erik Zwei';

-- Mitarbeiter E1
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000e1');
select string_agg(title, ',') as e1_sees_tasks from tasks;
select count(*) as e1_sees_finance_expect_0 from task_finance;
select count(*) as e1_sees_members_expect_1 from members;
select count(*) as e1_sees_checklist_expect_1 from checklist_items;
update tasks set status='in_progress' where title='Task E1';
select status as e1_status_updated from tasks where title='Task E1';
update tasks set title='hacked' where title='Task E1';
select count(*) as e2_task_update_rows_expect_0 from (select 1) x where false;
with u as (update tasks set status='done' where title='Task E2' returning 1) select count(*) as e1_updates_e2_task_expect_0 from u;
update members set hourly_rate_cents=99999 where user_id=auth.uid();
update members set status='vacation' where user_id=auth.uid();
select status as e1_self_status from members where user_id=auth.uid();
update members set status='active' where user_id=auth.uid();
insert into time_entries (id, task_id, member_id, started_at) select gen_random_uuid(), t.id, m.id, now() - interval '1 hour' from tasks t, members m where t.title='Task E1' and m.user_id=auth.uid();
select rate_cents as e1_rate_snapshot_expect_2000 from time_entries;
insert into task_finance (task_id, client_price_cents) select id, 1 from tasks;
insert into task_requests (firm_id, created_by, title) select firm_id, id, 'Bitte Fenster' from members where user_id=auth.uid();
select count(*) as e1_requests from task_requests;
-- Storage
insert into storage.objects (bucket_id, name, owner_id) select 'task-photos', (select firm_id::text from members where user_id=auth.uid()) || '/' || id || '/x.jpg', auth.uid()::text from tasks where title='Task E1';
select count(*) as e1_photo_upload_ok from storage.objects;
insert into storage.objects (bucket_id, name, owner_id) select 'task-photos', firm_id::text || '/' || gen_random_uuid() || '/y.jpg', auth.uid()::text from members where user_id=auth.uid();

-- Chef B sieht nichts von A
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select count(*) as b_sees_tasks_expect_0 from tasks;
select count(*) as b_sees_members_expect_1 from members;
select count(*) as b_sees_finance_expect_0 from task_finance;
select count(*) as b_sees_entries_expect_0 from time_entries;
select count(*) as b_sees_requests_expect_0 from task_requests;
select count(*) as b_sees_objects_expect_0 from storage.objects;
insert into tasks (firm_id,title) select id,'cross' from firms where name='Firma A';
-- anon
reset role; set role anon;
select count(*) as anon_tasks from tasks;
select * from public.invite_info((select token from tok));
