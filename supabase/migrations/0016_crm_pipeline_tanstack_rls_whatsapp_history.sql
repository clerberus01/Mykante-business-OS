create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  position integer not null,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, key),
  unique (organization_id, position),
  unique (id, organization_id)
);

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  stage_id uuid not null,
  title text not null,
  value numeric(14,2) not null default 0,
  probability integer not null default 10 check (probability between 0 and 100),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  expected_close_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint crm_deals_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete cascade,
  constraint crm_deals_stage_fk
    foreign key (stage_id, organization_id)
    references public.crm_pipeline_stages (id, organization_id)
    on delete restrict
);

create index if not exists crm_pipeline_stages_org_position_idx
on public.crm_pipeline_stages (organization_id, position);

create index if not exists crm_deals_org_stage_idx
on public.crm_deals (organization_id, stage_id, updated_at desc);

create unique index if not exists crm_deals_open_client_unique_idx
on public.crm_deals (organization_id, client_id)
where status = 'open';

drop trigger if exists set_crm_pipeline_stages_updated_at on public.crm_pipeline_stages;
create trigger set_crm_pipeline_stages_updated_at
before update on public.crm_pipeline_stages
for each row
execute function public.set_updated_at();

drop trigger if exists set_crm_deals_updated_at on public.crm_deals;
create trigger set_crm_deals_updated_at
before update on public.crm_deals
for each row
execute function public.set_updated_at();

insert into public.crm_pipeline_stages (organization_id, key, name, position, color, is_default)
select o.id, seed.key, seed.name, seed.position, seed.color, seed.is_default
from public.organizations o
cross join (
  values
    ('lead', 'Lead', 10, 'bg-blue-50 text-blue-600', true),
    ('qualified', 'Qualificado', 20, 'bg-purple-50 text-purple-600', true),
    ('proposal', 'Proposta', 30, 'bg-amber-50 text-amber-600', true),
    ('negotiation', 'Negociacao', 40, 'bg-orange-50 text-orange-600', true),
    ('closing', 'Fechamento', 50, 'bg-green-50 text-green-600', true)
) as seed(key, name, position, color, is_default)
on conflict (organization_id, key) do nothing;

insert into public.crm_deals (organization_id, client_id, stage_id, title, value, probability, created_by)
select
  c.organization_id,
  c.id,
  s.id,
  c.name,
  0,
  case c.status
    when 'lead' then 10
    when 'active' then 70
    else 30
  end,
  c.created_by
from public.clients c
join public.crm_pipeline_stages s
  on s.organization_id = c.organization_id
  and s.key = case c.status
    when 'lead' then 'lead'
    when 'active' then 'closing'
    else 'qualified'
  end
where c.deleted_at is null
on conflict do nothing;

revoke all on public.crm_pipeline_stages from anon;
revoke all on public.crm_deals from anon;

grant select, insert, update on public.crm_pipeline_stages to authenticated;
grant select, insert, update on public.crm_deals to authenticated;

alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_deals enable row level security;

alter table public.crm_pipeline_stages force row level security;
alter table public.crm_deals force row level security;

drop policy if exists "crm_pipeline_stages_select_org_members" on public.crm_pipeline_stages;
create policy "crm_pipeline_stages_select_org_members"
on public.crm_pipeline_stages
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "crm_pipeline_stages_insert_admin" on public.crm_pipeline_stages;
create policy "crm_pipeline_stages_insert_admin"
on public.crm_pipeline_stages
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "crm_pipeline_stages_update_admin" on public.crm_pipeline_stages;
create policy "crm_pipeline_stages_update_admin"
on public.crm_pipeline_stages
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "crm_deals_select_org_members" on public.crm_deals;
create policy "crm_deals_select_org_members"
on public.crm_deals
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "crm_deals_insert_org_members" on public.crm_deals;
create policy "crm_deals_insert_org_members"
on public.crm_deals
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.organization_id = crm_deals.organization_id
      and c.deleted_at is null
  )
  and exists (
    select 1
    from public.crm_pipeline_stages s
    where s.id = stage_id
      and s.organization_id = crm_deals.organization_id
  )
);

drop policy if exists "crm_deals_update_org_members" on public.crm_deals;
create policy "crm_deals_update_org_members"
on public.crm_deals
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.crm_pipeline_stages s
    where s.id = stage_id
      and s.organization_id = crm_deals.organization_id
  )
);

drop policy if exists "crm_deals_delete_none" on public.crm_deals;
create policy "crm_deals_delete_none"
on public.crm_deals
for delete
to authenticated
using (false);

create or replace function public.seed_crm_pipeline_for_organization(target_organization_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.crm_pipeline_stages (organization_id, key, name, position, color, is_default)
  values
    (target_organization_id, 'lead', 'Lead', 10, 'bg-blue-50 text-blue-600', true),
    (target_organization_id, 'qualified', 'Qualificado', 20, 'bg-purple-50 text-purple-600', true),
    (target_organization_id, 'proposal', 'Proposta', 30, 'bg-amber-50 text-amber-600', true),
    (target_organization_id, 'negotiation', 'Negociacao', 40, 'bg-orange-50 text-orange-600', true),
    (target_organization_id, 'closing', 'Fechamento', 50, 'bg-green-50 text-green-600', true)
  on conflict (organization_id, key) do nothing;
$$;

create or replace function public.seed_crm_pipeline_after_organization_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_crm_pipeline_for_organization(new.id);
  return new;
end;
$$;

drop trigger if exists seed_crm_pipeline_after_organization_insert on public.organizations;
create trigger seed_crm_pipeline_after_organization_insert
after insert on public.organizations
for each row
execute function public.seed_crm_pipeline_after_organization_insert();

create or replace function public.create_default_crm_deal_for_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_stage_id uuid;
begin
  perform public.seed_crm_pipeline_for_organization(new.organization_id);

  select s.id
  into target_stage_id
  from public.crm_pipeline_stages s
  where s.organization_id = new.organization_id
    and s.key = case new.status
      when 'lead' then 'lead'
      when 'active' then 'closing'
      else 'qualified'
    end
  limit 1;

  if target_stage_id is null then
    return new;
  end if;

  insert into public.crm_deals (
    organization_id,
    client_id,
    stage_id,
    title,
    value,
    probability,
    created_by
  )
  values (
    new.organization_id,
    new.id,
    target_stage_id,
    new.name,
    0,
    case new.status
      when 'lead' then 10
      when 'active' then 70
      else 30
    end,
    new.created_by
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_crm_deal_for_client on public.clients;
create trigger create_default_crm_deal_for_client
after insert on public.clients
for each row
execute function public.create_default_crm_deal_for_client();

create or replace function public.log_whatsapp_message_to_client_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client_id uuid;
  conversation_phone text;
begin
  select wc.client_id, wc.phone_e164
  into target_client_id, conversation_phone
  from public.whatsapp_conversations wc
  where wc.id = new.conversation_id
    and wc.organization_id = new.organization_id;

  if target_client_id is null then
    return new;
  end if;

  insert into public.client_events (
    organization_id,
    client_id,
    type,
    title,
    content,
    metadata,
    created_by,
    created_at
  )
  values (
    new.organization_id,
    target_client_id,
    'whatsapp',
    case when new.direction = 'inbound' then 'WhatsApp recebido' else 'WhatsApp enviado' end,
    new.body,
    jsonb_build_object(
      'messageId', new.id,
      'conversationId', new.conversation_id,
      'direction', new.direction,
      'status', new.status,
      'phone', conversation_phone
    ),
    coalesce(new.sent_by::text, 'system'),
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists log_whatsapp_message_to_client_timeline on public.whatsapp_messages;
create trigger log_whatsapp_message_to_client_timeline
after insert on public.whatsapp_messages
for each row
execute function public.log_whatsapp_message_to_client_timeline();

create unique index if not exists whatsapp_conversations_id_org_unique_idx
on public.whatsapp_conversations (id, organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_messages_conversation_org_fk'
  ) then
    alter table public.whatsapp_messages
    add constraint whatsapp_messages_conversation_org_fk
      foreign key (conversation_id, organization_id)
      references public.whatsapp_conversations (id, organization_id)
      on delete cascade;
  end if;
end $$;

drop policy if exists "whatsapp_messages_select_org_members" on public.whatsapp_messages;
create policy "whatsapp_messages_select_org_members"
on public.whatsapp_messages
for select
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.whatsapp_conversations wc
    where wc.id = conversation_id
      and wc.organization_id = whatsapp_messages.organization_id
  )
);

drop policy if exists "client_events_insert_org_members" on public.client_events;
create policy "client_events_insert_org_members"
on public.client_events
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.organization_id = client_events.organization_id
      and c.deleted_at is null
  )
);

drop policy if exists "client_events_delete_org_members" on public.client_events;
create policy "client_events_delete_org_members"
on public.client_events
for delete
to authenticated
using (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.organization_id = client_events.organization_id
  )
);

drop policy if exists "proposals_insert_org_members" on public.proposals;
create policy "proposals_insert_org_members"
on public.proposals
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.organization_id = proposals.organization_id
      and c.deleted_at is null
  )
);

drop policy if exists "proposals_update_org_members" on public.proposals;
create policy "proposals_update_org_members"
on public.proposals
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.organization_id = proposals.organization_id
      and c.deleted_at is null
  )
);

drop policy if exists "transactions_insert_org_members" on public.transactions;
create policy "transactions_insert_org_members"
on public.transactions
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    client_id is null
    or exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.organization_id = transactions.organization_id
        and c.deleted_at is null
    )
  )
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.organization_id = transactions.organization_id
        and p.deleted_at is null
    )
  )
);

drop policy if exists "transactions_update_org_members" on public.transactions;
create policy "transactions_update_org_members"
on public.transactions
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and (
    client_id is null
    or exists (
      select 1
      from public.clients c
      where c.id = client_id
        and c.organization_id = transactions.organization_id
        and c.deleted_at is null
    )
  )
  and (
    project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.organization_id = transactions.organization_id
        and p.deleted_at is null
    )
  )
);
