create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('owner', 'admin', 'manager', 'operator');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'notification_channel'
  ) then
    create type public.notification_channel as enum ('email', 'push', 'whatsapp');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'consent_status'
  ) then
    create type public.consent_status as enum ('granted', 'revoked', 'pending');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null,
  legal_name text,
  tax_id text,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  lgpd_contact_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists organizations_slug_key on public.organizations (slug) where deleted_at is null;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_email_key on public.profiles ((lower(email))) where email is not null;

create table if not exists public.organization_members (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null default 'operator',
  status text not null default 'active' check (status in ('invited', 'active', 'inactive')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create index if not exists organization_members_organization_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_logs_organization_idx on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);

create table if not exists public.consents (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subject_type text not null check (subject_type in ('user', 'client', 'lead', 'contact')),
  subject_id uuid,
  subject_email text,
  legal_basis text not null,
  purpose text not null,
  channel public.notification_channel not null,
  status public.consent_status not null default 'pending',
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint consents_subject_presence check (subject_id is not null or subject_email is not null)
);

create index if not exists consents_organization_idx on public.consents (organization_id, created_at desc);
create index if not exists consents_subject_idx on public.consents (subject_type, subject_id);

create table if not exists public.notification_preferences (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel public.notification_channel not null,
  enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id, channel)
);

create index if not exists notification_preferences_user_idx on public.notification_preferences (user_id);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role::text = any (allowed_roles)
  );
$$;

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_organization_members_updated_at on public.organization_members;
create trigger set_organization_members_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_consents_updated_at on public.consents;
create trigger set_consents_updated_at
before update on public.consents
for each row
execute function public.set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (
  id,
  email,
  full_name,
  avatar_url
)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
  updated_at = timezone('utc', now());

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consents enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "organizations_insert_authenticated" on public.organizations;
create policy "organizations_insert_authenticated"
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists "organization_members_select_member" on public.organization_members;
create policy "organization_members_select_member"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_admin" on public.organization_members;
create policy "organization_members_insert_admin"
on public.organization_members
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "organization_members_update_admin" on public.organization_members;
create policy "organization_members_update_admin"
on public.organization_members
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "organization_members_delete_owner" on public.organization_members;
create policy "organization_members_delete_owner"
on public.organization_members
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']));

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "audit_logs_insert_member" on public.audit_logs;
create policy "audit_logs_insert_member"
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "consents_select_manager" on public.consents;
create policy "consents_select_manager"
on public.consents
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "consents_insert_manager" on public.consents;
create policy "consents_insert_manager"
on public.consents
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "consents_update_manager" on public.consents;
create policy "consents_update_manager"
on public.consents
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "notification_preferences_select_self_or_admin" on public.notification_preferences;
create policy "notification_preferences_select_self_or_admin"
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "notification_preferences_insert_self_or_admin" on public.notification_preferences;
create policy "notification_preferences_insert_self_or_admin"
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "notification_preferences_update_self_or_admin" on public.notification_preferences;
create policy "notification_preferences_update_self_or_admin"
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
)
with check (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);
