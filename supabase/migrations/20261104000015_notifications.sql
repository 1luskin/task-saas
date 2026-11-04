-- =====================================================================
-- Etappe 12: Benachrichtigungen pro Typ, Merker für E-Mails (Testende, Wochenbericht)
-- =====================================================================
create table public.notification_prefs (
  member_id  uuid not null references public.members(id) on delete cascade,
  type       text not null check (type ~ '^[a-z_]{2,40}$'),
  enabled    boolean not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, type)
);
alter table public.notification_prefs enable row level security;
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (member_id = private.my_member_id())
  with check (member_id = private.my_member_id());

alter table public.firms
  add column trial_mail_sent_at timestamptz,
  add column weekly_mail_last date;
