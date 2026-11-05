\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('e1000000-0000-0000-0000-0000000000e1','e1@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select public.create_firm('A','Anna') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites; grant select on tok to authenticated; set role authenticated;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1'); select public.accept_invite((select token from tok),'Emil') is not null;
select 'no consent (muss scheitern)'; insert into geo_points (firm_id, member_id, kind, lat, lng) select firm_id, id, 'shift_start', 52.5, 13.4 from members where user_id=auth.uid();
insert into consents (user_id, kind, version, granted) values (auth.uid(), 'geolocation', 'v1', true);
insert into geo_points (firm_id, member_id, kind, lat, lng) select firm_id, id, 'shift_start', 52.5, 13.4 from members where user_id=auth.uid();
select 'with consent', count(*) from geo_points;
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
insert into consents (user_id, kind, version, granted) values (auth.uid(), 'geolocation', 'v1', false);
select 'revoked (muss scheitern)'; insert into geo_points (firm_id, member_id, kind, lat, lng) select firm_id, id, 'shift_end', 52.5, 13.4 from members where user_id=auth.uid();
delete from geo_points; select 'no delete', count(*) from geo_points;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a'); select 'boss sees', count(*) from geo_points;
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','B') is not null; select 'B sees', count(*) from geo_points;
