\set ON_ERROR_STOP 0
\pset tuples_only on
set role service_role;
select 'hits 1..5 allowed', bool_and(public.rate_limit_hit('otp_email:a@x.de', 5, 3600)) from generate_series(1,5);
select '6th denied', public.rate_limit_hit('otp_email:a@x.de', 5, 3600) = false;
select 'other bucket ok', public.rate_limit_hit('otp_email:b@x.de', 5, 3600);
select 'peek blocked', public.rate_limit_peek('otp_email:a@x.de', 5, 3600) = false;
reset role; set role authenticated;
select 'authenticated cannot call (muss scheitern)'; select public.rate_limit_hit('x', 1, 60);
set role anon;
select 'anon cannot call (muss scheitern)'; select public.rate_limit_hit('x', 1, 60);
