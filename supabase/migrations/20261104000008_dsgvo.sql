-- =====================================================================
-- Etappe 5: DSGVO – Einwilligungen (mit Datum + Textversion),
-- Firmenlöschung mit 30 Tagen Widerrufsfrist, Datenanfragen von Mitarbeitern.
-- =====================================================================

create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  member_id  uuid references public.members(id) on delete cascade,
  kind       text not null check (kind in ('cookies', 'geolocation', 'review_publish', 'terms')),
  version    text not null check (char_length(version) between 1 and 40),
  granted    boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents(user_id, kind, created_at desc);
alter table public.consents enable row level security;
create policy consents_own_select on public.consents for select to authenticated
  using (user_id = auth.uid());
create policy consents_own_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid() and (member_id is null or member_id = private.my_member_id()));
-- Chef sieht Einwilligungen seiner Mitarbeiter (z. B. Geolokalisierung)
create policy consents_boss_select on public.consents for select to authenticated
  using (private.is_boss() and member_id in (select id from public.members where firm_id = private.my_firm_id()));

-- Firmenlöschung: Antrag → 30 Tage → endgültig (Cron). Widerruf möglich.
alter table public.firms
  add column deletion_requested_at timestamptz,
  add column deletion_scheduled_for timestamptz;

-- Datenanfragen (Mitarbeiter: Löschung beantragen)
create table public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  kind        text not null check (kind in ('delete', 'export')),
  status      text not null default 'open' check (status in ('open', 'done', 'rejected')),
  note        text check (char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index data_requests_firm_idx on public.data_requests(firm_id, status);
alter table public.data_requests enable row level security;
create policy data_requests_select on public.data_requests for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or member_id = private.my_member_id()));
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (firm_id = private.my_firm_id() and member_id = private.my_member_id() and status = 'open');
create policy data_requests_update on public.data_requests for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
