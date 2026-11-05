-- Etappe 17: Firma B (Chef + Mitarbeiter) und anon sehen in KEINER Tabelle/keinem Bucket Daten von Firma A.
-- Firma A bekommt die volle Demo-Befüllung (alle Module), dazu Dateien in allen Buckets.
\set ON_ERROR_STOP 0
\pset tuples_only on
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a','a@x.de'),('b0000000-0000-0000-0000-00000000000b','b@x.de'),('b1000000-0000-0000-0000-0000000000b1','b1@x.de');
create function pg_temp.u(u text) returns void language sql as $$ select set_config('request.jwt.claim.sub', u, false) $$;
set role authenticated;
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
select public.create_firm('A','Anna') is not null, public.create_demo_firm() is not null;
reset role;
-- Dateien von A in allen Buckets
insert into storage.objects (bucket_id, name, owner_id)
  select b, f.id || '/' || gen_random_uuid() || '/x.jpg', 'a0000000-0000-0000-0000-00000000000a'
  from public.firms f, unnest(array['task-photos','receipts','task-files','report-photos','member-docs','avatars','firm-logos']) b;
select 'A rows total', (select count(*) from public.tasks) + (select count(*) from public.invoices) + (select count(*) from public.shift_plans) + (select count(*) from public.materials) > 20;
-- Firma B mit Mitarbeiter
set role authenticated;
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','Bert') is not null;
insert into invites (firm_id) select firm_id from members where user_id=auth.uid();
reset role; create temp table tok as select token from invites where firm_id = (select firm_id from members where user_id='b0000000-0000-0000-0000-00000000000b'); grant select on tok to authenticated; set role authenticated;
select pg_temp.u('b1000000-0000-0000-0000-0000000000b1'); select public.accept_invite((select token from tok),'Bea') is not null;
reset role;

-- Alle Tabellen im Schema public durchgehen: Zeilen, die nicht zu B gehören (B hat eigene Firma/Mitglieder/Status …)
create or replace function pg_temp.leaks(p_role text, p_uid text) returns table (tbl text, n bigint)
language plpgsql as $$
declare r record; v bigint; a uuid;
begin
  select id into a from public.firms where name = 'Demo · Glanz & Bau';
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' order by 1 loop
    begin
      execute format('set local role %I', p_role);
      perform set_config('request.jwt.claim.sub', p_uid, true);
      -- Spalte firm_id vorhanden → nur Firma-A-Zeilen zählen; sonst alle sichtbaren Zeilen (globale Tabellen ausgenommen)
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.relname and column_name = 'firm_id') then
        execute format('select count(*) from public.%I where firm_id in (select id from public.firms f where f.name in (''A'', ''Demo · Glanz & Bau''))', r.relname) into v;
      elsif r.relname = 'firms' then
        execute 'select count(*) from public.firms f where f.name in (''A'', ''Demo · Glanz & Bau'')' into v;
      elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = r.relname and column_name = 'user_id') then
        execute format('select count(*) from public.%I where user_id = %L', r.relname, 'a0000000-0000-0000-0000-00000000000a') into v;
      elsif r.relname in ('feature_flags', 'plans', 'site_content') then
        v := 0;
      else
        execute format('select count(*) from public.%I', r.relname) into v;
      end if;
      reset role;
      if v > 0 then tbl := r.relname; n := v; return next; end if;
    exception when insufficient_privilege then
      reset role; -- kein Zugriff = kein Leck
    end;
  end loop;
end $$;
grant execute on function pg_temp.leaks(text, text) to authenticated, anon;
select 'B boss leaks:', coalesce(string_agg(tbl || '=' || n, ', '), 'keine') from pg_temp.leaks('authenticated', 'b0000000-0000-0000-0000-00000000000b');
select 'B employee leaks:', coalesce(string_agg(tbl || '=' || n, ', '), 'keine') from pg_temp.leaks('authenticated', 'b1000000-0000-0000-0000-0000000000b1');
select 'anon leaks:', coalesce(string_agg(tbl || '=' || n, ', '), 'keine') from pg_temp.leaks('anon', '');
-- Storage
set role authenticated; select pg_temp.u('b0000000-0000-0000-0000-00000000000b');
select 'B sees A files', count(*) from storage.objects where owner_id = 'a0000000-0000-0000-0000-00000000000a';
-- RPCs mit IDs von A
select 'B issue A invoice (muss scheitern)'; select public.issue_invoice((select id from public.invoices limit 1));
reset role; create temp table aids as select (select id from invoices limit 1) inv, (select id from materials limit 1) mat, (select id from tasks limit 1) task, (select id from shift_swaps limit 1) swap, (select id from offers limit 1) off;
grant select on aids to authenticated; set role authenticated; select pg_temp.u('b0000000-0000-0000-0000-00000000000b');
select 'B cancel A invoice (muss scheitern)'; select public.cancel_invoice((select inv from aids));
select 'B use A material (muss scheitern)'; select * from public.use_material((select mat from aids), (select task from aids), 1);
select 'B restock A material (muss scheitern)'; select public.adjust_material_stock((select mat from aids), 5, 'in');
select 'B decide A swap (muss scheitern)'; select public.decide_swap((select swap from aids), 'approve');
select 'B send A offer (muss scheitern)'; select public.send_offer((select off from aids));
select 'B colleagues', count(*) from public.colleagues();
select 'B search A', count(*) from public.search_all('Treppenhaus');
