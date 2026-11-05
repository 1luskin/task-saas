-- Etappe 16: Rechnungen (§14, GoBD, Nummern), Storno, Angebote
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
insert into invoices (firm_id, buyer_name, buyer_street, buyer_zip, buyer_city, service_date) select firm_id, 'Kunde K', 'Weg 1', '10115', 'Berlin', current_date from members where user_id=auth.uid();
insert into invoice_items (invoice_id, description, qty, unit_price_cents, vat_rate) select id, 'Reinigung', 2, 10050, 19 from invoices;
insert into invoice_items (invoice_id, description, qty, unit_price_cents, vat_rate) select id, 'Buch', 1, 1000, 7 from invoices;
select 'issue without seller data (muss scheitern)'; select public.issue_invoice((select id from invoices limit 1));
update firms set address_street='Str 1', address_zip='10115', address_city='Berlin', tax_number='12/345/67890', invoice_prefix='RE';
select 'issued', public.issue_invoice((select id from invoices limit 1));
select 'totals', net_cents, vat_cents, gross_cents, status, retain_until > current_date + 3650, seller->>'city' from invoices;
select 'edit issued (muss scheitern)'; update invoices set buyer_name='X';
select 'edit item (muss scheitern)'; update invoice_items set qty=5;
select 'delete issued (muss scheitern)'; delete from invoices;
select 'insert item into issued (muss scheitern)'; insert into invoice_items (invoice_id, description, qty, unit_price_cents) select id, 'nachträglich', 1, 1 from invoices;
update invoices set status='paid'; select 'paid', status, paid_at is not null from invoices;
update invoices set status='sent'; select 'unpaid again', status, paid_at is null from invoices;
select 'cancel directly (muss scheitern)'; update invoices set status='cancelled';
-- zweite Rechnung → fortlaufende Nummer
insert into invoices (firm_id, buyer_name, buyer_street, buyer_zip, buyer_city, service_date) select firm_id, 'Kunde 2', 'Weg 2', '10115', 'Berlin', current_date from members where user_id=auth.uid();
insert into invoice_items (invoice_id, description, qty, unit_price_cents) select id, 'Leistung', 1, 5000 from invoices where number is null;
select 'issued 2', public.issue_invoice((select id from invoices where number is null));
-- Storno der ersten
select 'storno', public.cancel_invoice((select id from invoices where number like '%-0001'), 'Fehler') is not null;
select 'after storno', number, kind, status, gross_cents from invoices order by number;
select 'storno items negative', count(*) from invoice_items i join invoices v on v.id = i.invoice_id where v.kind='storno' and i.qty < 0;
select 'cancel storno (muss scheitern)'; select public.cancel_invoice((select id from invoices where kind='storno'));
-- Mitarbeiter sieht keine Rechnungen
select pg_temp.u('e1000000-0000-0000-0000-0000000000e1');
select 'emp sees invoices', count(*) from invoices; select 'emp items', count(*) from invoice_items;
select 'emp issue (muss scheitern)'; select public.issue_invoice((select id from invoices limit 1));
-- Angebot
select pg_temp.u('a0000000-0000-0000-0000-00000000000a');
insert into offers (firm_id, title, buyer_name, buyer_email, buyer_address) select firm_id, 'Fenster', 'Neukunde N', 'n@x.de', 'Allee 5, 10117 Berlin' from members where user_id=auth.uid();
insert into offer_items (offer_id, description, qty, unit_price_cents) select id, 'Fenster putzen', 10, 800 from offers;
select 'offer sent', public.send_offer((select id from offers limit 1));
select 'offer item after send (muss scheitern)'; insert into offer_items (offer_id, description, qty, unit_price_cents) select id, 'später', 1, 1 from offers;
reset role;
create temp table otok as select token from offers;
select 'accept', public.decide_offer((select token from otok), true, 'N. Neukunde') is not null;
select 'accepted', status, accepted_name, (select title from tasks where id = offers.task_id), (select client_price_cents from task_finance where task_id = offers.task_id), (select name from clients where id = offers.client_id) from offers;
select 'accept twice (muss scheitern)'; select public.decide_offer((select token from otok), true, 'X');
set role authenticated;
select 'anon decide (muss scheitern)'; set role anon; select public.decide_offer('x', true, 'X'); set role authenticated;
-- Firma B sieht nichts
select pg_temp.u('b0000000-0000-0000-0000-00000000000b'); select public.create_firm('B','B') is not null;
select 'B sees', (select count(*) from invoices), (select count(*) from offers), (select count(*) from invoice_items);
-- Firmenlöschung: Rechnungen bleiben (firm_id → null), Entwürfe weg
reset role;
delete from firms where name = 'A';
select 'retained after firm delete', count(*), count(*) filter (where firm_id is null) from invoices;
select 'purge (nothing due yet)', public.purge_expired_invoices();
update invoices set retain_until = current_date - 1 where kind = 'invoice'; -- (muss scheitern: GoBD)
