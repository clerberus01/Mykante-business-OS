create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_type text not null check (person_type in ('individual', 'company')),
  name text not null,
  tax_id text not null default '',
  tax_id_normalized text generated always as (regexp_replace(coalesce(tax_id, ''), '\D', '', 'g')) stored,
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone text not null,
  phone_normalized text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored,
  company text,
  status text not null check (status in ('active', 'inactive', 'archived', 'lead')),
  address_street text,
  address_number text,
  address_complement text,
  address_zip_code text,
  address_neighborhood text,
  address_city text,
  address_state text,
  due_day integer not null default 10 check (due_day between 1 and 31),
  pix_key text,
  banking_info text,
  tags text[] not null default '{}',
  attention text,
  origin text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create unique index if not exists clients_org_email_unique_idx
on public.clients (organization_id, email_normalized)
where deleted_at is null and email_normalized <> '';

create unique index if not exists clients_org_tax_id_unique_idx
on public.clients (organization_id, tax_id_normalized)
where deleted_at is null and tax_id_normalized <> '';

create index if not exists clients_org_created_at_idx
on public.clients (organization_id, created_at desc);

create index if not exists clients_org_status_idx
on public.clients (organization_id, status);

create unique index if not exists clients_id_org_unique_idx
on public.clients (id, organization_id);

drop trigger if exists set_clients_updated_at on public.clients;

create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  type text not null check (type in ('email', 'whatsapp', 'note', 'file', 'system')),
  title text not null,
  content text not null,
  metadata jsonb,
  created_by text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint client_events_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete cascade
);

create index if not exists client_events_client_created_at_idx
on public.client_events (client_id, created_at desc);

create index if not exists client_events_org_created_at_idx
on public.client_events (organization_id, created_at desc);

revoke all on public.clients from anon;
revoke all on public.client_events from anon;

grant select, insert, update on public.clients to authenticated;
grant select, insert, delete on public.client_events to authenticated;

alter table public.clients enable row level security;
alter table public.client_events enable row level security;

alter table public.clients force row level security;
alter table public.client_events force row level security;

drop policy if exists "clients_select_org_members" on public.clients;
create policy "clients_select_org_members"
on public.clients
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists "clients_insert_org_members" on public.clients;
create policy "clients_insert_org_members"
on public.clients
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
);

drop policy if exists "clients_update_org_members" on public.clients;
create policy "clients_update_org_members"
on public.clients
for update
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

drop policy if exists "clients_delete_none" on public.clients;
create policy "clients_delete_none"
on public.clients
for delete
to authenticated
using (false);

drop policy if exists "client_events_select_org_members" on public.client_events;
create policy "client_events_select_org_members"
on public.client_events
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists "client_events_insert_org_members" on public.client_events;
create policy "client_events_insert_org_members"
on public.client_events
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
);

drop policy if exists "client_events_update_none" on public.client_events;
create policy "client_events_update_none"
on public.client_events
for update
to authenticated
using (false)
with check (false);

drop policy if exists "client_events_delete_org_members" on public.client_events;
create policy "client_events_delete_org_members"
on public.client_events
for delete
to authenticated
using (
  public.is_org_member(organization_id)
);
