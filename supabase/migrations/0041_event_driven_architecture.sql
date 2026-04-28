-- Event-driven foundation: domain events for Supabase Realtime and webhook delivery queue.

create table if not exists public.domain_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  event_type text not null,
  source_table text not null,
  source_operation text not null check (source_operation in ('INSERT', 'UPDATE', 'DELETE')),
  aggregate_type text not null,
  aggregate_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists domain_events_org_occurred_idx
on public.domain_events (organization_id, occurred_at desc);

create index if not exists domain_events_type_occurred_idx
on public.domain_events (event_type, occurred_at desc);

create index if not exists domain_events_aggregate_idx
on public.domain_events (aggregate_type, aggregate_id, occurred_at desc);

create table if not exists public.event_webhook_endpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null check (url ~* '^https://'),
  secret text not null,
  event_types text[] not null default array['*']::text[],
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_webhook_endpoints_org_active_idx
on public.event_webhook_endpoints (organization_id, is_active);

drop trigger if exists set_event_webhook_endpoints_updated_at on public.event_webhook_endpoints;
create trigger set_event_webhook_endpoints_updated_at
before update on public.event_webhook_endpoints
for each row
execute function public.set_updated_at();

create table if not exists public.event_webhook_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.domain_events(id) on delete cascade,
  endpoint_id uuid not null references public.event_webhook_endpoints(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'delivering', 'delivered', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  response_body text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, endpoint_id)
);

create index if not exists event_webhook_deliveries_queue_idx
on public.event_webhook_deliveries (status, next_attempt_at asc)
where status in ('pending', 'failed');

create index if not exists event_webhook_deliveries_org_created_idx
on public.event_webhook_deliveries (organization_id, created_at desc);

drop trigger if exists set_event_webhook_deliveries_updated_at on public.event_webhook_deliveries;
create trigger set_event_webhook_deliveries_updated_at
before update on public.event_webhook_deliveries
for each row
execute function public.set_updated_at();

create or replace function public.domain_event_type(table_name text, operation text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case table_name
    when 'clients' then 'crm.client.' || lower(operation)
    when 'client_events' then 'crm.timeline_event.' || lower(operation)
    when 'crm_deals' then 'crm.deal.' || lower(operation)
    when 'proposals' then 'sales.proposal.' || lower(operation)
    when 'projects' then 'projects.project.' || lower(operation)
    when 'tasks' then 'projects.task.' || lower(operation)
    when 'transactions' then 'finance.transaction.' || lower(operation)
    when 'payment_requests' then 'finance.payment_request.' || lower(operation)
    when 'documents' then 'documents.document.' || lower(operation)
    when 'contracts' then 'contracts.contract.' || lower(operation)
    when 'calendar_events' then 'calendar.event.' || lower(operation)
    when 'whatsapp_conversations' then 'communications.conversation.' || lower(operation)
    when 'whatsapp_messages' then 'communications.message.' || lower(operation)
    when 'automation_runs' then 'automations.run.' || lower(operation)
    else replace(table_name, '_', '.') || '.' || lower(operation)
  end;
$$;

create or replace function public.emit_domain_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  row_data jsonb := case when tg_op = 'DELETE' then old_row else new_row end;
  changed_columns text[] := array[]::text[];
  event_organization_id uuid;
  event_aggregate_id uuid;
  current_actor_id uuid := auth.uid();
  event_actor_user_id uuid;
begin
  if tg_table_schema <> 'public' or tg_table_name in ('domain_events', 'event_webhook_endpoints', 'event_webhook_deliveries', 'audit_logs') then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    changed_columns := public.audit_changed_columns(old_row, new_row);

    if cardinality(changed_columns) = 0 then
      return coalesce(new, old);
    end if;
  end if;

  if row_data ? 'organization_id' and nullif(row_data ->> 'organization_id', '') is not null then
    event_organization_id := (row_data ->> 'organization_id')::uuid;
  elsif tg_table_name = 'organizations' and row_data ? 'id' then
    event_organization_id := (row_data ->> 'id')::uuid;
  else
    return coalesce(new, old);
  end if;

  if row_data ? 'id'
    and nullif(row_data ->> 'id', '') is not null
    and (row_data ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    event_aggregate_id := (row_data ->> 'id')::uuid;
  end if;

  select current_actor_id
  into event_actor_user_id
  where current_actor_id is not null
    and exists (select 1 from public.profiles p where p.id = current_actor_id);

  insert into public.domain_events (
    organization_id,
    event_type,
    source_table,
    source_operation,
    aggregate_type,
    aggregate_id,
    actor_user_id,
    payload
  )
  values (
    event_organization_id,
    public.domain_event_type(tg_table_name, tg_op),
    tg_table_name,
    tg_op,
    tg_table_name,
    event_aggregate_id,
    event_actor_user_id,
    jsonb_build_object(
      'changed_columns', changed_columns,
      'old', case when tg_op in ('UPDATE', 'DELETE') then public.audit_redact_row(old_row) else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then public.audit_redact_row(new_row) else null end
    )
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.queue_domain_event_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.event_webhook_deliveries (
    organization_id,
    event_id,
    endpoint_id
  )
  select
    new.organization_id,
    new.id,
    endpoint.id
  from public.event_webhook_endpoints endpoint
  where endpoint.organization_id = new.organization_id
    and endpoint.is_active
    and (
      endpoint.event_types @> array['*']::text[]
      or endpoint.event_types @> array[new.event_type]::text[]
    )
  on conflict (event_id, endpoint_id) do nothing;

  return new;
end;
$$;

drop trigger if exists queue_domain_event_webhooks on public.domain_events;
create trigger queue_domain_event_webhooks
after insert on public.domain_events
for each row
execute function public.queue_domain_event_webhooks();

do $$
declare
  event_table text;
begin
  foreach event_table in array array[
    'clients',
    'client_events',
    'crm_deals',
    'proposals',
    'projects',
    'tasks',
    'transactions',
    'payment_requests',
    'documents',
    'contracts',
    'calendar_events',
    'whatsapp_conversations',
    'whatsapp_messages',
    'automation_runs'
  ]
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = event_table
    ) then
      execute format('drop trigger if exists emit_%I_domain_event on public.%I', event_table, event_table);
      execute format(
        'create trigger emit_%I_domain_event after insert or update or delete on public.%I for each row execute function public.emit_domain_event()',
        event_table,
        event_table
      );
    end if;
  end loop;
end $$;

revoke all on public.domain_events from anon;
revoke all on public.event_webhook_endpoints from anon;
revoke all on public.event_webhook_deliveries from anon;

grant select on public.domain_events to authenticated;
grant select, insert, update, delete on public.event_webhook_endpoints to authenticated;
grant select on public.event_webhook_deliveries to authenticated;

alter table public.domain_events enable row level security;
alter table public.domain_events force row level security;
alter table public.event_webhook_endpoints enable row level security;
alter table public.event_webhook_endpoints force row level security;
alter table public.event_webhook_deliveries enable row level security;
alter table public.event_webhook_deliveries force row level security;

drop policy if exists "domain_events_select_org_members" on public.domain_events;
create policy "domain_events_select_org_members"
on public.domain_events
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "domain_events_insert_none" on public.domain_events;
create policy "domain_events_insert_none"
on public.domain_events
for insert
to authenticated
with check (false);

drop policy if exists "domain_events_update_none" on public.domain_events;
create policy "domain_events_update_none"
on public.domain_events
for update
to authenticated
using (false)
with check (false);

drop policy if exists "domain_events_delete_none" on public.domain_events;
create policy "domain_events_delete_none"
on public.domain_events
for delete
to authenticated
using (false);

drop policy if exists "event_webhook_endpoints_select_admin" on public.event_webhook_endpoints;
create policy "event_webhook_endpoints_select_admin"
on public.event_webhook_endpoints
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "event_webhook_endpoints_insert_admin" on public.event_webhook_endpoints;
create policy "event_webhook_endpoints_insert_admin"
on public.event_webhook_endpoints
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
  and created_by = auth.uid()
);

drop policy if exists "event_webhook_endpoints_update_admin" on public.event_webhook_endpoints;
create policy "event_webhook_endpoints_update_admin"
on public.event_webhook_endpoints
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "event_webhook_endpoints_delete_admin" on public.event_webhook_endpoints;
create policy "event_webhook_endpoints_delete_admin"
on public.event_webhook_endpoints
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "event_webhook_deliveries_select_admin" on public.event_webhook_deliveries;
create policy "event_webhook_deliveries_select_admin"
on public.event_webhook_deliveries
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

do $$
begin
  begin
    alter publication supabase_realtime add table public.domain_events;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

select public.attach_audit_triggers();
