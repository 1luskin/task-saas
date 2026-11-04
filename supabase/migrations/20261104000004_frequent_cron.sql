-- =====================================================================
-- Häufiger Cron (alle 15 Minuten) über Supabase pg_cron + pg_net.
-- Ruft /api/cron/frequent der App auf (Auto-Abnahme, Erinnerungen …).
-- STANDARDMÄSSIG AUS: einschalten per
--   select private.enable_frequent_cron('https://DEINE-APP.de/api/cron/frequent', 'CRON_SECRET');
-- ausschalten per
--   select private.disable_frequent_cron();
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

create or replace function private.enable_frequent_cron(p_url text, p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_url !~ '^https://' then
    raise exception 'URL muss mit https:// beginnen';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_cron und pg_net müssen aktiviert sein (Supabase → Database → Extensions)';
  end if;
  execute format(
    'select cron.schedule(%L, %L, %L)',
    'app-frequent',
    '*/15 * * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(%L, %L), body := %L::jsonb, timeout_milliseconds := 55000)',
           p_url, 'Authorization', 'Bearer ' || p_secret, '{}')
  );
end $$;

create or replace function private.disable_frequent_cron() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'select cron.unschedule(jobid) from cron.job where jobname = ''app-frequent''';
  end if;
end $$;

-- Nur für Datenbank-Admins (SQL Editor), nicht über die API
revoke all on function private.enable_frequent_cron(text, text) from public, anon, authenticated;
revoke all on function private.disable_frequent_cron() from public, anon, authenticated;
