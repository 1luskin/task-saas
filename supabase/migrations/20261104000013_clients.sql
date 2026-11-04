-- =====================================================================
-- Etappe 10: Kunden, Kunden-Link (/c/[token]), öffentliche Anfrage-Seite (/f/[slug]).
-- Öffentliche Zugriffe laufen ausschließlich serverseitig (service_role) nach Token-Prüfung.
-- =====================================================================

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 160),
  email      text check (email is null or char_length(email) <= 254),
  phone      text check (phone is null or char_length(phone) <= 40),
  address    text check (address is null or char_length(address) <= 300),
  notes      text check (notes is null or char_length(notes) <= 2000),
  hide_price boolean not null default false, -- Preis auf dem Kunden-Link ausblenden
  created_at timestamptz not null default now()
);
create index clients_firm_idx on public.clients(firm_id, name);
alter table public.clients enable row level security;
create policy clients_boss_select on public.clients for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy clients_boss_insert on public.clients for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
create policy clients_boss_update on public.clients for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy clients_boss_delete on public.clients for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

alter table public.tasks
  add column client_id uuid references public.clients(id) on delete set null,
  add column accepted_via text check (accepted_via in ('boss', 'auto', 'client'));
create index tasks_client_idx on public.tasks(client_id);

-- Kunde muss zur selben Firma gehören
create or replace function private.guard_task_client() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.client_id is not null and (tg_op = 'INSERT' or new.client_id is distinct from old.client_id) then
    if not exists (select 1 from public.clients c where c.id = new.client_id and c.firm_id = new.firm_id) then
      raise exception 'invalid client' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not private.is_boss()
     and (new.client_id is distinct from old.client_id or new.accepted_via is distinct from old.accepted_via) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger tasks_client_guard before insert or update on public.tasks
  for each row execute function private.guard_task_client();

-- Fotos vorher/nachher
alter table public.task_photos add column kind text not null default 'general' check (kind in ('general', 'before', 'after'));

-- Kunden-Link: langer Zufallstoken, widerrufbar, mit Ablauf
create table public.task_links (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default now() + interval '60 days',
  revoked    boolean not null default false,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index task_links_task_idx on public.task_links(task_id);
alter table public.task_links enable row level security;
create trigger task_links_firm before insert on public.task_links
  for each row execute function private.inherit_task_firm();
create policy task_links_boss_select on public.task_links for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy task_links_boss_insert on public.task_links for insert to authenticated
  with check (private.is_boss() and private.can_see_task(task_id) and private.firm_can_write(private.my_firm_id()));
create policy task_links_boss_update on public.task_links for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());

-- Öffentliche Firmenseite mit Anfrageformular
alter table public.firms add column public_slug text unique check (public_slug is null or public_slug ~ '^[a-z0-9-]{3,40}$');

create table public.inbound_requests (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 160),
  contact    text not null check (char_length(contact) between 3 and 254),
  address    text check (address is null or char_length(address) <= 300),
  message    text not null check (char_length(message) between 1 and 4000),
  status     text not null default 'new' check (status in ('new', 'converted', 'dismissed')),
  task_id    uuid references public.tasks(id) on delete set null,
  client_id  uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inbound_firm_idx on public.inbound_requests(firm_id, status, created_at desc);
alter table public.inbound_requests enable row level security;
create policy inbound_boss_select on public.inbound_requests for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy inbound_boss_update on public.inbound_requests for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
-- Einfügen nur serverseitig (öffentliches Formular mit Rate-Limit/Honeypot/Turnstile)

-- Demo-Firma: Kunden + Link
create or replace function private.seed_demo_clients(p_firm uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c1 uuid; c2 uuid;
begin
  insert into public.clients (firm_id, name, email, phone, address) values
    (p_firm, 'Hausverwaltung Schmidt', 'kontakt@hv-schmidt.invalid', '+49 30 1234567', 'Karl-Marx-Allee 12, 10243 Berlin') returning id into c1;
  insert into public.clients (firm_id, name, email, address) values
    (p_firm, 'Praxis Dr. Klein', 'praxis@klein.invalid', 'Schönhauser Allee 40, 10435 Berlin') returning id into c2;
  update public.tasks set client_id = c1 where firm_id = p_firm and title like 'Treppenhaus%';
  update public.tasks set client_id = c2 where firm_id = p_firm and title like 'Grundreinigung%';
  update public.tasks set client_id = c1 where firm_id = p_firm and title = 'Badfliesen verfugen';
  insert into public.task_links (task_id) select id from public.tasks where firm_id = p_firm and title = 'Badfliesen verfugen';
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
  return v_firm;
end $$;
