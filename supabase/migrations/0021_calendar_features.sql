create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('meeting', 'technical_visit', 'client_call', 'time_block', 'travel', 'day_off', 'maintenance')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recurrence_rule text check (recurrence_rule in ('none', 'weekly', 'monthly')),
  recurrence_until timestamptz,
  client_id uuid,
  project_id uuid,
  location text,
  meeting_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'cancelled', 'completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint calendar_events_valid_range check (ends_at > starts_at),
  constraint calendar_events_client_fk
    foreign key (client_id, organization_id)
    references public.clients(id, organization_id)
    on delete set null,
  constraint calendar_events_project_fk
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete set null
);

create unique index if not exists calendar_events_id_org_unique_idx
on public.calendar_events(id, organization_id);

create table if not exists public.calendar_event_attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  attendee_type text not null check (attendee_type in ('internal', 'client', 'external')),
  name text not null,
  email text,
  phone_e164 text,
  response_status text not null default 'pending' check (response_status in ('pending', 'confirmed', 'declined')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint calendar_event_attendees_event_fk
    foreign key (event_id, organization_id)
    references public.calendar_events(id, organization_id)
    on delete cascade
);

create table if not exists public.calendar_booking_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique,
  title text not null,
  duration_minutes integer not null default 60,
  event_type text not null default 'client_call',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_external_sync_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook')),
  account_email text,
  status text not null default 'pending_oauth' check (status in ('pending_oauth', 'connected', 'error', 'disabled')),
  webhook_status text not null default 'not_configured' check (webhook_status in ('not_configured', 'active', 'error')),
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, provider, account_email)
);

create index if not exists calendar_events_org_start_idx
on public.calendar_events(organization_id, starts_at);

create index if not exists calendar_event_attendees_event_idx
on public.calendar_event_attendees(organization_id, event_id);

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

drop trigger if exists set_calendar_external_sync_accounts_updated_at on public.calendar_external_sync_accounts;
create trigger set_calendar_external_sync_accounts_updated_at
before update on public.calendar_external_sync_accounts
for each row
execute function public.set_updated_at();

alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;
alter table public.calendar_booking_links enable row level security;
alter table public.calendar_external_sync_accounts enable row level security;

drop policy if exists "calendar_events_select_org_members" on public.calendar_events;
create policy "calendar_events_select_org_members"
on public.calendar_events for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_events_insert_org_members" on public.calendar_events;
create policy "calendar_events_insert_org_members"
on public.calendar_events for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_events_update_org_members" on public.calendar_events;
create policy "calendar_events_update_org_members"
on public.calendar_events for update to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_events_delete_org_members" on public.calendar_events;
create policy "calendar_events_delete_org_members"
on public.calendar_events for delete to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_attendees_select_org_members" on public.calendar_event_attendees;
create policy "calendar_attendees_select_org_members"
on public.calendar_event_attendees for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_attendees_insert_org_members" on public.calendar_event_attendees;
create policy "calendar_attendees_insert_org_members"
on public.calendar_event_attendees for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_attendees_update_org_members" on public.calendar_event_attendees;
create policy "calendar_attendees_update_org_members"
on public.calendar_event_attendees for update to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_booking_links_select_org_members" on public.calendar_booking_links;
create policy "calendar_booking_links_select_org_members"
on public.calendar_booking_links for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_booking_links_insert_org_members" on public.calendar_booking_links;
create policy "calendar_booking_links_insert_org_members"
on public.calendar_booking_links for insert to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_external_sync_select_org_members" on public.calendar_external_sync_accounts;
create policy "calendar_external_sync_select_org_members"
on public.calendar_external_sync_accounts for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_external_sync_insert_org_members" on public.calendar_external_sync_accounts;
create policy "calendar_external_sync_insert_org_members"
on public.calendar_external_sync_accounts for insert to authenticated
with check (public.is_org_member(organization_id));
