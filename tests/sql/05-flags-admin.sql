\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
select 'flags visible', count(*) > 5 from feature_flags;
insert into firm_features (firm_id, key, enabled) select firm_id,'kanban',false from members where user_id=auth.uid();
select 'boss toggled', enabled from firm_features where key='kanban';
select 'boss cannot set admin lock (muss scheitern)'; insert into firm_features (firm_id, key, enabled, set_by) select firm_id,'invoices',true,'admin' from members where user_id=auth.uid();
select 'audit invisible', count(*) from admin_audit;
select 'overview denied (muss scheitern)'; select * from public.admin_firm_overview();
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','Bernd') is not null;
select 'B sees A features', count(*) from firm_features;
reset role; select set_config('request.jwt.claim.sub','',false); set role service_role;
select 'service overview', count(*) from public.admin_firm_overview();
