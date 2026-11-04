-- =====================================================================
-- Etappe 3: Testzeitraum (14 Tage), Tarif-Status, Demo-Firma (Sandbox),
-- "Ansehen als Mitarbeiter" (acting) NUR in Demo-Firmen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Firmen: Tarif/Testzeitraum/Demo
-- ---------------------------------------------------------------------
alter table public.firms
  add column trial_ends_at timestamptz not null default now() + interval '14 days',
  add column plan text not null default 'trial' check (plan in ('trial', 'paid', 'expired', 'blocked')),
  add column is_demo boolean not null default false,
  add column contact_email text;

update public.firms set trial_ends_at = created_at + interval '14 days';

-- Darf die Firma neue Daten anlegen? (Testzeitraum läuft / bezahlt / Demo)
create or replace function private.firm_can_write(p_firm uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select f.is_demo
        or (f.plan = 'paid')
        or (f.plan = 'trial' and f.trial_ends_at > now())
    from public.firms f where f.id = p_firm
  ), false)
$$;
grant execute on function private.firm_can_write(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Mitgliedschaften: max. eine echte + eine Demo-Firma pro Nutzer
-- ---------------------------------------------------------------------
alter table public.members add column is_demo boolean not null default false;
alter table public.members drop constraint if exists members_user_id_key;
create unique index members_one_real_firm on public.members(user_id) where user_id is not null and not is_demo;
create unique index members_one_demo_firm on public.members(user_id) where user_id is not null and is_demo;

-- Nutzer-Einstellungen: aktive Mitgliedschaft + "Ansehen als" (nur Demo)
create table public.user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  active_member_id uuid references public.members(id) on delete set null,
  acting_member_id uuid references public.members(id) on delete set null,
  onboarding_done  boolean not null default false,
  hints_dismissed  text[] not null default '{}',
  updated_at       timestamptz not null default now()
);
alter table public.user_settings enable row level security;
-- nur lesen; Schreiben ausschließlich über geprüfte RPCs (switch_firm, set_acting, …)
create policy user_settings_own on public.user_settings for select to authenticated
  using (user_id = auth.uid());

-- Wirksame Mitgliedschaft: aktive (eigene) → sonst echte Firma → sonst Demo.
-- "acting" (Mitarbeiter-Ansicht) nur, wenn aktive Firma eine Demo-Firma ist,
-- man dort Chef ist und das Ziel ein Demo-Mitarbeiter ohne Login ist.
create or replace function private.current_member_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_active uuid;
  v_acting uuid;
  v_id uuid;
  v_role text;
  v_demo boolean;
  v_firm uuid;
begin
  if v_uid is null then
    return null;
  end if;
  select us.active_member_id, us.acting_member_id into v_active, v_acting
  from public.user_settings us where us.user_id = v_uid;

  if v_active is not null then
    select m.id, m.role, m.is_demo, m.firm_id into v_id, v_role, v_demo, v_firm
    from public.members m where m.id = v_active and m.user_id = v_uid and m.archived_at is null;
  end if;
  if v_id is null then
    select m.id, m.role, m.is_demo, m.firm_id into v_id, v_role, v_demo, v_firm
    from public.members m where m.user_id = v_uid and m.archived_at is null
    order by m.is_demo asc limit 1;
  end if;
  if v_id is null then
    return null;
  end if;

  if v_acting is not null and v_role = 'boss' and v_demo then
    if exists (
      select 1 from public.members a join public.firms f on f.id = a.firm_id
      where a.id = v_acting and a.firm_id = v_firm and a.user_id is null and a.archived_at is null and f.is_demo
    ) then
      return v_acting;
    end if;
  end if;
  return v_id;
end $$;

create or replace function private.my_member_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select private.current_member_id()
$$;

create or replace function private.my_firm_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.firm_id from public.members m where m.id = private.current_member_id()
$$;

create or replace function private.is_boss() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.role = 'boss' from public.members m where m.id = private.current_member_id()), false)
$$;

-- Mitglieder: "sich selbst" jetzt über die wirksame Mitgliedschaft (auch acting)
drop policy members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (firm_id = private.my_firm_id() and (private.is_boss() or id = private.my_member_id()));
drop policy members_update_self on public.members;
create policy members_update_self on public.members for update to authenticated
  using (id = private.my_member_id())
  with check (id = private.my_member_id());

-- Guard: Mitarbeiter darf is_demo nicht ändern
create or replace function private.guard_member_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_boss() then
    if new.is_demo is distinct from old.is_demo and auth.uid() is not null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.firm_id is distinct from old.firm_id
     or new.user_id is distinct from old.user_id
     or new.role is distinct from old.role
     or new.group_id is distinct from old.group_id
     or new.pay_mode is distinct from old.pay_mode
     or new.hourly_rate_cents is distinct from old.hourly_rate_cents
     or new.archived_at is distinct from old.archived_at
     or new.email is distinct from old.email
     or new.is_demo is distinct from old.is_demo then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;

-- Firmen: Tarif/Testzeitraum/Demo nur per service_role (Superadmin) änderbar
create or replace function private.guard_firm_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (
       new.trial_ends_at is distinct from old.trial_ends_at
    or new.plan is distinct from old.plan
    or new.is_demo is distinct from old.is_demo) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger firms_guard before update on public.firms
  for each row execute function private.guard_firm_update();

-- ---------------------------------------------------------------------
-- Schreibschutz nach Testzeitraum: Anlegen nur, wenn firm_can_write
-- (Lesen und Export bleiben immer möglich)
-- ---------------------------------------------------------------------
drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));

drop policy invites_boss on public.invites;
create policy invites_select on public.invites for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy invites_insert on public.invites for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
create policy invites_update on public.invites for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy invites_delete on public.invites for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

drop policy templates_boss on public.task_templates;
create policy templates_select on public.task_templates for select to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());
create policy templates_insert on public.task_templates for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
create policy templates_update on public.task_templates for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy templates_delete on public.task_templates for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

drop policy groups_write on public.groups;
create policy groups_insert on public.groups for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
create policy groups_update on public.groups for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy groups_delete on public.groups for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

drop policy statuses_write on public.task_statuses;
create policy statuses_insert on public.task_statuses for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));
create policy statuses_update on public.task_statuses for update to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss())
  with check (firm_id = private.my_firm_id() and private.is_boss());
create policy statuses_delete on public.task_statuses for delete to authenticated
  using (firm_id = private.my_firm_id() and private.is_boss());

drop policy members_insert_boss on public.members;
create policy members_insert_boss on public.members for insert to authenticated
  with check (firm_id = private.my_firm_id() and private.is_boss() and private.firm_can_write(firm_id));

drop policy requests_insert on public.task_requests;
create policy requests_insert on public.task_requests for insert to authenticated
  with check (firm_id = private.my_firm_id() and created_by = private.my_member_id()
              and status = 'pending' and private.firm_can_write(firm_id));

drop policy checklist_insert on public.checklist_items;
create policy checklist_insert on public.checklist_items for insert to authenticated
  with check (private.is_boss() and private.can_see_task(task_id) and private.firm_can_write(private.my_firm_id()));

drop policy comments_insert on public.task_comments;
create policy comments_insert on public.task_comments for insert to authenticated
  with check (private.can_see_task(task_id) and author_id = private.my_member_id() and private.firm_can_write(private.my_firm_id()));

drop policy photos_insert on public.task_photos;
create policy photos_insert on public.task_photos for insert to authenticated
  with check (private.can_see_task(task_id) and uploaded_by = private.my_member_id() and private.firm_can_write(private.my_firm_id()));

drop policy time_insert on public.time_entries;
create policy time_insert on public.time_entries for insert to authenticated
  with check (private.can_see_task(task_id)
              and (member_id = private.my_member_id() or private.is_boss())
              and private.firm_can_write(private.my_firm_id()));

-- ---------------------------------------------------------------------
-- Onboarding-RPCs: echte Firma nur einmal; Beitritt nur zu aktiven Firmen
-- ---------------------------------------------------------------------
create or replace function public.create_firm(p_firm_name text, p_full_name text, p_locale text default 'de')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_firm uuid;
  v_member uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid and not is_demo) then
    raise exception 'already member' using errcode = '23505';
  end if;
  if char_length(trim(coalesce(p_firm_name, ''))) = 0
     or char_length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = v_uid;

  insert into public.firms (name, contact_email) values (trim(p_firm_name), v_email) returning id into v_firm;
  insert into public.members (firm_id, user_id, role, full_name, email, locale, pay_mode)
  values (v_firm, v_uid, 'boss', trim(p_full_name), v_email,
          case when p_locale in ('de', 'ru') then p_locale else 'de' end, 'fixed')
  returning id into v_member;
  insert into public.user_settings (user_id, active_member_id) values (v_uid, v_member)
  on conflict (user_id) do update set active_member_id = excluded.active_member_id, acting_member_id = null, updated_at = now();
  return v_firm;
end $$;

create or replace function public.accept_invite(p_token text, p_full_name text, p_locale text default 'de')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_inv    public.invites%rowtype;
  v_member uuid;
  v_email  text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_uid and not is_demo) then
    raise exception 'already member' using errcode = '23505';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'invalid input' using errcode = '22023';
  end if;

  select * into v_inv from public.invites where token = p_token for update;
  if not found or v_inv.revoked or v_inv.expires_at <= now() or v_inv.used_count >= v_inv.max_uses
     or not private.firm_can_write(v_inv.firm_id) then
    raise exception 'invite invalid' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = v_uid;
  insert into public.members (firm_id, user_id, role, full_name, email, group_id, locale)
  values (v_inv.firm_id, v_uid, v_inv.role, trim(p_full_name), v_email, v_inv.group_id,
          case when p_locale in ('de', 'ru') then p_locale else 'de' end)
  returning id into v_member;

  update public.invites set used_count = used_count + 1 where id = v_inv.id;
  insert into public.user_settings (user_id, active_member_id) values (v_uid, v_member)
  on conflict (user_id) do update set active_member_id = excluded.active_member_id, acting_member_id = null, updated_at = now();
  return v_member;
end $$;

-- Wirksamer Kontext für die App (welche Mitgliedschaft, acting, Demo vorhanden?)
create or replace function public.current_context()
returns table (member_id uuid, real_member_id uuid, own_member_id uuid, demo_member_id uuid, acting boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_eff uuid := private.current_member_id();
  v_own uuid;
  v_demo uuid;
  v_real uuid;
begin
  if v_uid is null then
    return;
  end if;
  select id into v_own from public.members where user_id = v_uid and not is_demo and archived_at is null;
  select id into v_demo from public.members where user_id = v_uid and is_demo and archived_at is null;
  select coalesce(
    (select m.id from public.members m join public.user_settings us on us.active_member_id = m.id
      where us.user_id = v_uid and m.user_id = v_uid and m.archived_at is null),
    v_own, v_demo) into v_real;
  return query select v_eff, v_real, v_own, v_demo, (v_eff is distinct from v_real);
end $$;

-- Zwischen eigener Firma und Demo-Firma wechseln
create or replace function public.switch_firm(p_target text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select id into v_member from public.members
  where user_id = v_uid and archived_at is null and is_demo = (p_target = 'demo');
  if v_member is null then
    raise exception 'no such membership' using errcode = '22023';
  end if;
  insert into public.user_settings (user_id, active_member_id) values (v_uid, v_member)
  on conflict (user_id) do update set active_member_id = v_member, acting_member_id = null, updated_at = now();
end $$;

-- "Ansehen als Mitarbeiter": nur Demo-Firma, nur deren Chef, nur Demo-Mitarbeiter ohne Login
create or replace function public.set_acting(p_member uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_real public.members%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select m.* into v_real from public.members m
  join public.user_settings us on us.active_member_id = m.id
  where us.user_id = v_uid and m.user_id = v_uid and m.archived_at is null;
  if p_member is null then
    update public.user_settings set acting_member_id = null, updated_at = now() where user_id = v_uid;
    return;
  end if;
  if v_real.id is null or v_real.role <> 'boss' or not v_real.is_demo
     or not exists (
       select 1 from public.members a join public.firms f on f.id = a.firm_id
       where a.id = p_member and a.firm_id = v_real.firm_id and a.user_id is null and f.is_demo and a.archived_at is null) then
    raise exception 'acting only in demo firm' using errcode = '42501';
  end if;
  update public.user_settings set acting_member_id = p_member, updated_at = now() where user_id = v_uid;
end $$;

create or replace function public.dismiss_hint(p_key text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.user_settings (user_id, hints_dismissed) values (auth.uid(), array[left(p_key, 40)])
  on conflict (user_id) do update set hints_dismissed = array(select distinct unnest(public.user_settings.hints_dismissed || array[left(p_key, 40)])), updated_at = now();
$$;

create or replace function public.finish_onboarding()
returns void
language sql security definer set search_path = '' as $$
  insert into public.user_settings (user_id, onboarding_done) values (auth.uid(), true)
  on conflict (user_id) do update set onboarding_done = true, updated_at = now();
$$;

revoke all on function public.current_context() from public, anon;
revoke all on function public.switch_firm(text) from public, anon;
revoke all on function public.set_acting(uuid) from public, anon;
revoke all on function public.dismiss_hint(text) from public, anon;
revoke all on function public.finish_onboarding() from public, anon;
grant execute on function public.current_context() to authenticated;
grant execute on function public.switch_firm(text) to authenticated;
grant execute on function public.set_acting(uuid) to authenticated;
grant execute on function public.dismiss_hint(text) to authenticated;
grant execute on function public.finish_onboarding() to authenticated;

-- Systemstatus-Schutz: beim Löschen der ganzen Firma (Kaskade, z. B. Demo-Reset) erlauben
create or replace function private.guard_task_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system and auth.uid() is not null
       and exists (select 1 from public.firms where id = old.firm_id) then
      raise exception 'system status' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.is_system and (new.kind is distinct from old.kind or new.is_system is distinct from old.is_system or new.firm_id is distinct from old.firm_id) then
    raise exception 'system status' using errcode = '42501';
  end if;
  return new;
end $$;
