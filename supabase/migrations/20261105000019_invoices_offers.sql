-- =====================================================================
-- Etappe 16: Angebote und Rechnungen (§ 14 UStG, § 19 UStG, GoBD).
-- - Rechnungsnummer lückenlos je Firma und Jahr: Zähler mit Zeilensperre,
--   Vergabe erst beim Ausstellen (Entwürfe haben keine Nummer).
-- - Ausgestellte Rechnungen sind unveränderlich (Trigger); Korrektur nur per Stornorechnung.
-- - Aufbewahrung 10 Jahre: Rechnungen bleiben bei Firmenlöschung erhalten (firm_id → null,
--   Verkäufer-/Käuferdaten als Kopie in der Rechnung) und werden erst nach retain_until gelöscht.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Firma: Rechnungssteller-Daten
-- ---------------------------------------------------------------------
alter table public.firms
  add column legal_name         text check (legal_name is null or char_length(legal_name) <= 160),
  add column address_street     text check (address_street is null or char_length(address_street) <= 160),
  add column address_zip        text check (address_zip is null or address_zip ~ '^[0-9A-Za-z -]{3,10}$'),
  add column address_city       text check (address_city is null or char_length(address_city) <= 80),
  add column address_country    text not null default 'DE' check (address_country ~ '^[A-Z]{2}$'),
  add column tax_number         text check (tax_number is null or char_length(tax_number) <= 40),
  add column vat_id             text check (vat_id is null or vat_id ~ '^[A-Z]{2}[0-9A-Za-z+*.]{2,12}$'),
  add column iban               text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  add column bic                text check (bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  add column bank_name          text check (bank_name is null or char_length(bank_name) <= 80),
  add column invoice_email      text check (invoice_email is null or char_length(invoice_email) <= 254),
  add column invoice_phone      text check (invoice_phone is null or char_length(invoice_phone) <= 40),
  add column invoice_prefix     text not null default 'RE' check (invoice_prefix ~ '^[A-Z0-9]{1,8}$'),
  add column payment_terms_days smallint not null default 14 check (payment_terms_days between 0 and 120);

-- Kunden: strukturierte Adresse für Rechnungen/XRechnung (optional zusätzlich zu address)
alter table public.clients
  add column street  text check (street is null or char_length(street) <= 160),
  add column zip     text check (zip is null or char_length(zip) <= 10),
  add column city    text check (city is null or char_length(city) <= 80),
  add column country text not null default 'DE' check (country ~ '^[A-Z]{2}$'),
  add column vat_id  text check (vat_id is null or char_length(vat_id) <= 20);

-- ---------------------------------------------------------------------
-- Nummernkreise (nur über security-definer-Funktionen)
-- ---------------------------------------------------------------------
create table public.doc_counters (
  firm_id uuid not null references public.firms(id) on delete cascade,
  kind    text not null check (kind in ('invoice', 'offer')),
  year    integer not null,
  last_no integer not null default 0,
  primary key (firm_id, kind, year)
);
alter table public.doc_counters enable row level security; -- keine Policies: nur Funktionen

create or replace function private.next_doc_no(p_firm uuid, p_kind text, p_year integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  insert into public.doc_counters (firm_id, kind, year) values (p_firm, p_kind, p_year) on conflict do nothing;
  -- Zeilensperre bis Transaktionsende → keine doppelten Nummern; Rollback setzt den Zähler mit zurück → keine Lücken
  update public.doc_counters set last_no = last_no + 1
   where firm_id = p_firm and kind = p_kind and year = p_year
  returning last_no into v;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Rechnungen
-- ---------------------------------------------------------------------
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid references public.firms(id) on delete set null,
  kind             text not null default 'invoice' check (kind in ('invoice', 'storno')),
  number           text,
  status           text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
  client_id        uuid references public.clients(id) on delete set null,
  task_id          uuid references public.tasks(id) on delete set null,
  offer_id         uuid,
  cancels_id       uuid references public.invoices(id) on delete set null,
  issue_date       date,
  service_date     date,
  service_date_to  date,
  due_date         date,
  buyer_name       text not null default '' check (char_length(buyer_name) <= 160),
  buyer_street     text check (buyer_street is null or char_length(buyer_street) <= 160),
  buyer_zip        text check (buyer_zip is null or char_length(buyer_zip) <= 10),
  buyer_city       text check (buyer_city is null or char_length(buyer_city) <= 80),
  buyer_country    text not null default 'DE' check (buyer_country ~ '^[A-Z]{2}$'),
  buyer_vat_id     text check (buyer_vat_id is null or char_length(buyer_vat_id) <= 20),
  buyer_email      text check (buyer_email is null or char_length(buyer_email) <= 254),
  buyer_reference  text check (buyer_reference is null or char_length(buyer_reference) <= 100), -- Leitweg-ID / Bestellnummer
  seller           jsonb not null default '{}'::jsonb, -- Kopie der Firmendaten beim Ausstellen
  small_business   boolean not null default false,
  note             text check (note is null or char_length(note) <= 2000),
  net_cents        bigint not null default 0,
  vat_cents        bigint not null default 0,
  gross_cents      bigint not null default 0,
  sent_at          timestamptz,
  paid_at          timestamptz,
  retain_until     date,
  created_by       uuid references public.members(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (firm_id, number)
);
create index invoices_firm_idx on public.invoices(firm_id, created_at desc);
alter table public.invoices enable row level security;
create policy invoices_boss_select on public.invoices for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy invoices_boss_insert on public.invoices for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id)
              and status = 'draft' and number is null and kind = 'invoice');
create policy invoices_boss_update on public.invoices for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy invoices_boss_delete on public.invoices for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss() and status = 'draft');

create table public.invoice_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.invoices(id) on delete cascade,
  position         smallint not null default 0,
  description      text not null check (char_length(description) between 1 and 500),
  qty              numeric(12, 3) not null check (qty <> 0),
  unit             text not null default 'Stk' check (char_length(unit) between 1 and 20),
  unit_price_cents bigint not null check (unit_price_cents between 0 and 100000000),
  vat_rate         smallint not null default 19 check (vat_rate in (0, 7, 19))
);
create index invoice_items_inv_idx on public.invoice_items(invoice_id, position);
alter table public.invoice_items enable row level security;
create or replace function private.can_edit_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.invoices i where i.id = p_invoice and i.firm_id = private.my_firm_id() and private.is_boss())
$$;
create policy invoice_items_select on public.invoice_items for select to authenticated using (private.can_edit_invoice(invoice_id));
create policy invoice_items_write on public.invoice_items for all to authenticated
  using (private.can_edit_invoice(invoice_id)) with check (private.can_edit_invoice(invoice_id));

-- GoBD: ausgestellte Rechnung unveränderlich. Erlaubt sind nur
--   * Zahlungsstatus sent ↔ paid (paid_at),
--   * sent/paid → cancelled durch Storno (app.gobd = 'storno'),
--   * Verweise (firm/client/task/created_by/offer/cancels) → null bei Löschung (Daten liegen als Kopie vor).
create or replace function private.guard_invoice() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and coalesce(current_setting('app.gobd', true), '') <> 'retention' then
      raise exception 'invoice locked (GoBD)' using errcode = '42501', hint = 'invoice_locked';
    end if;
    return old;
  end if;
  if old.status = 'draft' then
    new.updated_at := now();
    return new;
  end if;
  if (to_jsonb(new) - array['firm_id', 'client_id', 'task_id', 'created_by', 'offer_id', 'cancels_id', 'status', 'paid_at', 'updated_at'])
     is distinct from (to_jsonb(old) - array['firm_id', 'client_id', 'task_id', 'created_by', 'offer_id', 'cancels_id', 'status', 'paid_at', 'updated_at'])
     or (new.firm_id is distinct from old.firm_id and new.firm_id is not null)
     or (new.client_id is distinct from old.client_id and new.client_id is not null)
     or (new.task_id is distinct from old.task_id and new.task_id is not null)
     or (new.created_by is distinct from old.created_by and new.created_by is not null)
     or (new.offer_id is distinct from old.offer_id and new.offer_id is not null)
     or (new.cancels_id is distinct from old.cancels_id and new.cancels_id is not null) then
    raise exception 'invoice locked (GoBD)' using errcode = '42501', hint = 'invoice_locked';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'sent' and new.status = 'paid') or (old.status = 'paid' and new.status = 'sent')
            or (old.status in ('sent', 'paid') and new.status = 'cancelled' and coalesce(current_setting('app.gobd', true), '') = 'storno')) then
      raise exception 'invoice locked (GoBD)' using errcode = '42501', hint = 'invoice_locked';
    end if;
  end if;
  if new.status = 'paid' then new.paid_at := coalesce(new.paid_at, now()); else new.paid_at := null; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger invoices_guard before update or delete on public.invoices
  for each row execute function private.guard_invoice();

create or replace function private.guard_invoice_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is not null and v_status <> 'draft' and coalesce(current_setting('app.gobd', true), '') not in ('retention', 'storno') then
    raise exception 'invoice locked (GoBD)' using errcode = '42501', hint = 'invoice_locked';
  end if;
  return coalesce(new, old);
end $$;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function private.guard_invoice_item();

-- Summen nach § 14 UStG: Nettobeträge je Position, Steuer je Steuersatz gerundet
create or replace function private.invoice_totals(p_invoice uuid, p_small boolean, out net bigint, out vat bigint)
language sql stable security definer set search_path = '' as $$
  with lines as (
    select vat_rate, round(qty * unit_price_cents)::bigint as line_net from public.invoice_items where invoice_id = p_invoice
  ), per_rate as (
    select vat_rate, sum(line_net) as n from lines group by vat_rate
  )
  select coalesce(sum(n), 0)::bigint,
         case when p_small then 0 else coalesce(sum(round(n * vat_rate / 100.0)), 0)::bigint end
  from per_rate
$$;

-- Ausstellen: Pflichtangaben prüfen, Nummer vergeben, Verkäuferdaten einfrieren
create or replace function public.issue_invoice(p_invoice uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_inv  public.invoices%rowtype;
  v_firm public.firms%rowtype;
  v_date date := (now() at time zone 'Europe/Berlin')::date;
  v_no   integer;
  v_net  bigint; v_vat bigint;
begin
  if not private.is_boss() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v_inv from public.invoices where id = p_invoice and firm_id = private.my_firm_id() for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if v_inv.status <> 'draft' then raise exception 'invoice locked (GoBD)' using errcode = '42501', hint = 'invoice_locked'; end if;
  select * into v_firm from public.firms where id = v_inv.firm_id;
  if not private.firm_can_write(v_firm.id) then raise exception 'trial expired' using errcode = '42501', hint = 'expired'; end if;
  -- Pflichtangaben § 14 Abs. 4 UStG
  if coalesce(v_firm.address_street, '') = '' or coalesce(v_firm.address_zip, '') = '' or coalesce(v_firm.address_city, '') = ''
     or (coalesce(v_firm.tax_number, '') = '' and coalesce(v_firm.vat_id, '') = '') then
    raise exception 'seller data incomplete' using errcode = '23514', hint = 'seller_incomplete';
  end if;
  if coalesce(trim(v_inv.buyer_name), '') = '' or coalesce(v_inv.buyer_city, '') = '' or coalesce(v_inv.buyer_zip, '') = '' or coalesce(v_inv.buyer_street, '') = '' then
    raise exception 'buyer data incomplete' using errcode = '23514', hint = 'buyer_incomplete';
  end if;
  if v_inv.service_date is null then raise exception 'service date missing' using errcode = '23514', hint = 'service_date'; end if;
  if not exists (select 1 from public.invoice_items where invoice_id = v_inv.id) then
    raise exception 'no items' using errcode = '23514', hint = 'no_items';
  end if;
  select net, vat into v_net, v_vat from private.invoice_totals(v_inv.id, v_firm.small_business);
  if v_net <= 0 and v_inv.kind = 'invoice' then raise exception 'no items' using errcode = '23514', hint = 'no_items'; end if;
  v_date := coalesce(v_inv.issue_date, v_date);
  v_no := private.next_doc_no(v_firm.id, 'invoice', extract(year from v_date)::integer);
  update public.invoices set
    number = v_firm.invoice_prefix || '-' || extract(year from v_date)::integer || '-' || lpad(v_no::text, 4, '0'),
    issue_date = v_date,
    due_date = coalesce(due_date, v_date + v_firm.payment_terms_days),
    small_business = v_firm.small_business,
    net_cents = v_net, vat_cents = v_vat, gross_cents = v_net + v_vat,
    seller = jsonb_build_object(
      'name', coalesce(nullif(v_firm.legal_name, ''), v_firm.name), 'street', v_firm.address_street, 'zip', v_firm.address_zip,
      'city', v_firm.address_city, 'country', v_firm.address_country, 'tax_number', v_firm.tax_number, 'vat_id', v_firm.vat_id,
      'iban', v_firm.iban, 'bic', v_firm.bic, 'bank', v_firm.bank_name, 'email', v_firm.invoice_email, 'phone', v_firm.invoice_phone),
    retain_until = make_date(extract(year from v_date)::integer + 11, 1, 1),
    status = 'sent', sent_at = now()
  where id = v_inv.id;
  return (select number from public.invoices where id = v_inv.id);
end $$;
revoke all on function public.issue_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;

-- Storno: Stornorechnung mit negativen Positionen und eigener Nummer; Original → cancelled
create or replace function public.cancel_invoice(p_invoice uuid, p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_inv  public.invoices%rowtype;
  v_date date := (now() at time zone 'Europe/Berlin')::date;
  v_id   uuid;
  v_no   integer;
  v_prefix text;
begin
  if not private.is_boss() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v_inv from public.invoices where id = p_invoice and firm_id = private.my_firm_id() for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if v_inv.kind <> 'invoice' or v_inv.status not in ('sent', 'paid') then
    raise exception 'cannot cancel' using errcode = '23514', hint = 'cannot_cancel';
  end if;
  select invoice_prefix into v_prefix from public.firms where id = v_inv.firm_id;
  v_no := private.next_doc_no(v_inv.firm_id, 'invoice', extract(year from v_date)::integer);
  perform set_config('app.gobd', 'storno', true);
  insert into public.invoices (firm_id, kind, number, status, client_id, task_id, cancels_id, issue_date, service_date, service_date_to, due_date,
    buyer_name, buyer_street, buyer_zip, buyer_city, buyer_country, buyer_vat_id, buyer_email, buyer_reference, seller, small_business, note,
    net_cents, vat_cents, gross_cents, sent_at, retain_until, created_by)
  values (v_inv.firm_id, 'storno', v_prefix || '-' || extract(year from v_date)::integer || '-' || lpad(v_no::text, 4, '0'), 'sent',
    v_inv.client_id, v_inv.task_id, v_inv.id, v_date, v_inv.service_date, v_inv.service_date_to, v_date,
    v_inv.buyer_name, v_inv.buyer_street, v_inv.buyer_zip, v_inv.buyer_city, v_inv.buyer_country, v_inv.buyer_vat_id, v_inv.buyer_email, v_inv.buyer_reference,
    v_inv.seller, v_inv.small_business, left(coalesce(nullif(trim(p_reason), ''), 'Stornierung'), 2000),
    -v_inv.net_cents, -v_inv.vat_cents, -v_inv.gross_cents, now(), make_date(extract(year from v_date)::integer + 11, 1, 1), private.my_member_id())
  returning id into v_id;
  insert into public.invoice_items (invoice_id, position, description, qty, unit, unit_price_cents, vat_rate)
    select v_id, position, description, -qty, unit, unit_price_cents, vat_rate from public.invoice_items where invoice_id = v_inv.id;
  update public.invoices set status = 'cancelled' where id = v_inv.id;
  perform set_config('app.gobd', '', true);
  return v_id;
end $$;
revoke all on function public.cancel_invoice(uuid, text) from public, anon;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;

-- Aufbewahrung abgelaufen → endgültig löschen (nur Cron/service_role)
create or replace function public.purge_expired_invoices() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform set_config('app.gobd', 'retention', true);
  delete from public.invoices where status <> 'draft' and retain_until is not null and retain_until <= (now() at time zone 'Europe/Berlin')::date;
  get diagnostics n = row_count;
  -- verwaiste Entwürfe gelöschter Firmen
  delete from public.invoices where firm_id is null and status = 'draft';
  perform set_config('app.gobd', '', true);
  return n;
end $$;
revoke all on function public.purge_expired_invoices() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Angebote
-- ---------------------------------------------------------------------
create table public.offers (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  number        text,
  status        text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  client_id     uuid references public.clients(id) on delete set null,
  task_id       uuid references public.tasks(id) on delete set null,
  title         text not null check (char_length(title) between 1 and 200),
  intro         text check (intro is null or char_length(intro) <= 3000),
  buyer_name    text not null default '' check (char_length(buyer_name) <= 160),
  buyer_email   text check (buyer_email is null or char_length(buyer_email) <= 254),
  buyer_address text check (buyer_address is null or char_length(buyer_address) <= 300),
  valid_until   date,
  token         text not null unique default encode(gen_random_bytes(24), 'hex'),
  net_cents     bigint not null default 0,
  vat_cents     bigint not null default 0,
  gross_cents   bigint not null default 0,
  small_business boolean not null default false,
  sent_at       timestamptz,
  decided_at    timestamptz,
  accepted_name text check (accepted_name is null or char_length(accepted_name) <= 120),
  created_by    uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (firm_id, number)
);
create index offers_firm_idx on public.offers(firm_id, created_at desc);
alter table public.offers enable row level security;
create policy offers_boss on public.offers for all to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));

create table public.offer_items (
  id               uuid primary key default gen_random_uuid(),
  offer_id         uuid not null references public.offers(id) on delete cascade,
  position         smallint not null default 0,
  description      text not null check (char_length(description) between 1 and 500),
  qty              numeric(12, 3) not null check (qty > 0),
  unit             text not null default 'Stk' check (char_length(unit) between 1 and 20),
  unit_price_cents bigint not null check (unit_price_cents between 0 and 100000000),
  vat_rate         smallint not null default 19 check (vat_rate in (0, 7, 19))
);
alter table public.offer_items enable row level security;
create policy offer_items_boss on public.offer_items for all to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and o.firm_id = private.my_firm_id() and private.is_boss()))
  with check (exists (select 1 from public.offers o where o.id = offer_id and o.firm_id = private.my_firm_id() and private.is_boss() and o.status = 'draft'));

-- Angebot versenden: Nummer, Summen einfrieren
create or replace function public.send_offer(p_offer uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_off public.offers%rowtype;
  v_firm public.firms%rowtype;
  v_date date := (now() at time zone 'Europe/Berlin')::date;
  v_no integer; v_net bigint; v_vat bigint;
begin
  if not private.is_boss() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v_off from public.offers where id = p_offer and firm_id = private.my_firm_id() for update;
  if not found then raise exception 'not found' using errcode = '42501'; end if;
  if v_off.status <> 'draft' then return v_off.number; end if;
  select * into v_firm from public.firms where id = v_off.firm_id;
  if not private.firm_can_write(v_firm.id) then raise exception 'trial expired' using errcode = '42501', hint = 'expired'; end if;
  if coalesce(trim(v_off.buyer_name), '') = '' then raise exception 'buyer missing' using errcode = '23514', hint = 'buyer_incomplete'; end if;
  with per_rate as (
    select vat_rate, sum(round(qty * unit_price_cents)) as n from public.offer_items where offer_id = v_off.id group by vat_rate
  ) select coalesce(sum(n), 0)::bigint, case when v_firm.small_business then 0 else coalesce(sum(round(n * vat_rate / 100.0)), 0)::bigint end
    into v_net, v_vat from per_rate;
  if v_net <= 0 then raise exception 'no items' using errcode = '23514', hint = 'no_items'; end if;
  v_no := private.next_doc_no(v_firm.id, 'offer', extract(year from v_date)::integer);
  update public.offers set number = 'AN-' || extract(year from v_date)::integer || '-' || lpad(v_no::text, 4, '0'),
    status = 'sent', sent_at = now(), small_business = v_firm.small_business, net_cents = v_net, vat_cents = v_vat, gross_cents = v_net + v_vat,
    valid_until = coalesce(valid_until, v_date + 30), updated_at = now()
  where id = v_off.id;
  return (select number from public.offers where id = v_off.id);
end $$;
revoke all on function public.send_offer(uuid) from public, anon;
grant execute on function public.send_offer(uuid) to authenticated;

-- Annahme/Ablehnung über den Link (nur Server mit service_role; Token ist das Geheimnis)
-- Annahme legt Kunden (falls nötig) und Aufgabe mit Kundenpreis = Nettosumme an.
create or replace function public.decide_offer(p_token text, p_accept boolean, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_off public.offers%rowtype;
  v_client uuid;
  v_task uuid;
  v_desc text;
begin
  select * into v_off from public.offers where token = p_token for update;
  if not found or v_off.status <> 'sent' or (v_off.valid_until is not null and v_off.valid_until < (now() at time zone 'Europe/Berlin')::date) then
    raise exception 'offer not open' using errcode = '23514', hint = 'offer_closed';
  end if;
  if not p_accept then
    update public.offers set status = 'declined', decided_at = now(), accepted_name = left(nullif(trim(p_name), ''), 120), updated_at = now() where id = v_off.id;
    return null;
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required' using errcode = '23514', hint = 'name_required'; end if;
  v_client := v_off.client_id;
  if v_client is null then
    insert into public.clients (firm_id, name, email, address) values (v_off.firm_id, v_off.buyer_name, v_off.buyer_email, v_off.buyer_address)
    returning id into v_client;
  end if;
  select string_agg('• ' || description || ' (' || trim(trailing '.' from trim(trailing '0' from qty::text)) || ' ' || unit || ')', E'\n' order by position)
    into v_desc from public.offer_items where offer_id = v_off.id;
  insert into public.tasks (firm_id, title, description, address, client_id)
    values (v_off.firm_id, left(v_off.title, 200), left(coalesce(v_off.intro || E'\n\n', '') || coalesce(v_desc, ''), 5000), left(v_off.buyer_address, 300), v_client)
    returning id into v_task;
  insert into public.task_finance (task_id, firm_id, client_price_cents) values (v_task, v_off.firm_id, v_off.net_cents)
    on conflict (task_id) do update set client_price_cents = excluded.client_price_cents;
  update public.offers set status = 'accepted', decided_at = now(), accepted_name = left(trim(p_name), 120), client_id = v_client, task_id = v_task, updated_at = now()
    where id = v_off.id;
  return v_task;
end $$;
revoke all on function public.decide_offer(text, boolean, text) from public, anon, authenticated;

alter table public.invoices add constraint invoices_offer_fk foreign key (offer_id) references public.offers(id) on delete set null;

-- ---------------------------------------------------------------------
-- Demo-Firma: Rechnungsdaten, ein Entwurf, ein versendetes Angebot; Funktion eingeschaltet
-- ---------------------------------------------------------------------
create or replace function private.seed_demo_invoices(p_firm uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_client uuid; v_task uuid; v_inv uuid; v_off uuid; v_price integer;
begin
  update public.firms set legal_name = 'Glanz & Bau Service GmbH (Demo)', address_street = 'Musterstraße 1', address_zip = '10115',
    address_city = 'Berlin', tax_number = '30/123/45678', iban = 'DE02120300000000202051', bic = 'BYLADEM1001', bank_name = 'Demo-Bank',
    invoice_email = 'rechnung@demo.invalid' where id = p_firm;
  insert into public.firm_features (firm_id, key, enabled, set_by) values (p_firm, 'invoices', true, 'boss')
    on conflict (firm_id, key) do update set enabled = true;
  select id into v_client from public.clients where firm_id = p_firm order by created_at limit 1;
  if v_client is not null then
    update public.clients set street = 'Karl-Marx-Allee 12', zip = '10243', city = 'Berlin' where id = v_client;
  end if;
  select t.id, coalesce(f.client_price_cents, 0) into v_task, v_price from public.tasks t left join public.task_finance f on f.task_id = t.id
    where t.firm_id = p_firm and t.status = 'done' order by t.accepted_at desc nulls last limit 1;
  insert into public.invoices (firm_id, client_id, task_id, service_date, buyer_name, buyer_street, buyer_zip, buyer_city)
    select p_firm, v_client, v_task, (now() at time zone 'Europe/Berlin')::date - 1, c.name, 'Karl-Marx-Allee 12', '10243', 'Berlin'
    from public.clients c where c.id = v_client
    returning id into v_inv;
  if v_inv is not null then
    insert into public.invoice_items (invoice_id, position, description, qty, unit, unit_price_cents, vat_rate)
      values (v_inv, 0, coalesce((select title from public.tasks where id = v_task), 'Reinigung'), 1, 'Pausch.', greatest(v_price, 15000), 19);
  end if;
  insert into public.offers (firm_id, client_id, title, intro, buyer_name, buyer_email, buyer_address, status, number, sent_at, valid_until, net_cents, vat_cents, gross_cents)
    values (p_firm, null, 'Grundreinigung Büro 3. OG', 'Vielen Dank für Ihre Anfrage. Gerne bieten wir an:', 'Kanzlei Weiß', 'kanzlei@demo.invalid',
            'Friedrichstraße 100, 10117 Berlin', 'sent', 'AN-' || extract(year from now())::integer || '-0001', now(), (now() at time zone 'Europe/Berlin')::date + 30, 42000, 7980, 49980)
    returning id into v_off;
  insert into public.offer_items (offer_id, position, description, qty, unit, unit_price_cents, vat_rate) values
    (v_off, 0, 'Grundreinigung Büroflächen (ca. 120 m²)', 1, 'Pausch.', 36000, 19),
    (v_off, 1, 'Fensterreinigung innen/außen', 12, 'Stk', 500, 19);
  insert into public.doc_counters (firm_id, kind, year, last_no) values (p_firm, 'offer', extract(year from now())::integer, 1)
    on conflict (firm_id, kind, year) do update set last_no = greatest(public.doc_counters.last_no, 1);
end $$;

create or replace function public.create_demo_firm()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_own public.members%rowtype;
  v_firm uuid;
  v_boss uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select firm_id into v_firm from public.members where user_id = v_uid and is_demo;
  if v_firm is not null then
    return v_firm;
  end if;
  select * into v_own from public.members where user_id = v_uid and not is_demo and archived_at is null;
  if v_own.id is null or v_own.role <> 'boss' then
    raise exception 'only bosses get a demo firm' using errcode = '42501';
  end if;
  insert into public.firms (name, is_demo, plan) values ('Demo · Glanz & Bau', true, 'trial') returning id into v_firm;
  insert into public.members (firm_id, user_id, role, full_name, email, locale, pay_mode, is_demo)
    values (v_firm, v_uid, 'boss', v_own.full_name, v_own.email, v_own.locale, 'fixed', true) returning id into v_boss;
  perform private.seed_demo_firm(v_firm, v_boss);
  perform private.seed_demo_extras(v_firm);
  perform private.seed_demo_clients(v_firm);
  perform private.seed_demo_team(v_firm);
  perform private.seed_demo_materials(v_firm);
  perform private.seed_demo_invoices(v_firm);
  return v_firm;
end $$;
