-- =====================================================================
-- Etappe 4: Rate-Limits in Postgres (funktioniert serverless), Re-Auth
-- für gefährliche Aktionen, Login-Protokoll.
-- =====================================================================

create table private.rate_limits (
  bucket       text not null,       -- z. B. 'otp_email:max@x.de', 'otp_ip:1.2.3.4'
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, window_start)
);
create index rate_limits_cleanup on private.rate_limits(window_start);
alter table private.rate_limits enable row level security; -- kein Zugriff außer über die Funktion

/**
 * Zählt einen Treffer und sagt, ob er erlaubt ist.
 * Fenster: fest (floor auf window_seconds). Nur service_role darf aufrufen.
 */
create or replace function public.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_bucket is null or char_length(p_bucket) > 200 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit call' using errcode = '22023';
  end if;
  insert into private.rate_limits as r (bucket, window_start, hits) values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- gelegentlich aufräumen
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_hits <= p_max;
end $$;

/** Nur lesen (z. B. "noch gesperrt?") ohne zu zählen */
create or replace function public.rate_limit_peek(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.hits < p_max from private.rate_limits r
    where r.bucket = p_bucket
      and r.window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
  ), true)
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_peek(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_peek(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- Re-Auth: Zeitpunkt der letzten Code-Bestätigung (für gefährliche Aktionen)
-- und Login-Protokoll (für "Journal der Anmeldungen", Etappe 8)
-- ---------------------------------------------------------------------
alter table public.user_settings add column reauth_at timestamptz;

create table public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('login', 'reauth', 'logout', 'logout_all')),
  user_agent text,
  ip_hash    text,      -- gehashte IP (keine Klartext-IP gespeichert)
  created_at timestamptz not null default now()
);
create index login_events_user_idx on public.login_events(user_id, created_at desc);
alter table public.login_events enable row level security;
create policy login_events_own on public.login_events for select to authenticated
  using (user_id = auth.uid());
-- Einfügen nur serverseitig (service_role)
