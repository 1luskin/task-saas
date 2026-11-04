-- =====================================================================
-- Etappe 6/7: Inhalte der Landingpage (Superadmin-pflegbar), Tarifpreise,
-- Bewertungen von Kunden mit Moderation (nur echte, freigegebene).
-- =====================================================================

-- Texte der Landingpage je Sprache (JSON überschreibt Standardwerte im Code)
create table public.site_content (
  key        text not null check (key in ('landing')),
  locale     text not null check (locale in ('de', 'ru')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);
alter table public.site_content enable row level security;
create policy site_content_public on public.site_content for select to anon, authenticated using (true);
-- Schreiben nur service_role (Superadmin-Bereich auf dem Server)

-- Tarife (Preis pro Mitarbeiter/Monat in Cent; null = noch nicht festgelegt)
create table public.plans (
  id          text primary key check (id in ('start', 'pro')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  position    smallint not null default 0,
  updated_at  timestamptz not null default now()
);
insert into public.plans (id, position) values ('start', 0), ('pro', 1) on conflict do nothing;
alter table public.plans enable row level security;
create policy plans_public on public.plans for select to anon, authenticated using (true);

-- Bewertungen von Kunden (über den Kunden-Link, Etappe 10)
create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete set null,
  client_name   text check (char_length(client_name) <= 80),
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (char_length(comment) <= 2000),
  allow_publish boolean not null default false,
  moderation    text not null default 'pending' check (moderation in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);
create index reviews_firm_idx on public.reviews(firm_id, created_at desc);
create index reviews_public_idx on public.reviews(moderation, allow_publish) where moderation = 'approved' and allow_publish;
alter table public.reviews enable row level security;
create policy reviews_boss_select on public.reviews for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
-- Einfügen/Moderation nur serverseitig (service_role)

-- Öffentliche, freigegebene Bewertungen für die Landingpage (ohne Firmen-/Personendaten außer Vorname)
create or replace function public.published_reviews(p_limit integer default 6)
returns table (client_name text, rating smallint, comment text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select split_part(coalesce(r.client_name, ''), ' ', 1), r.rating, r.comment, r.created_at
  from public.reviews r
  join public.firms f on f.id = r.firm_id
  where r.moderation = 'approved' and r.allow_publish and not f.is_demo and coalesce(r.comment, '') <> ''
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 12)
$$;
grant execute on function public.published_reviews(integer) to anon, authenticated;
