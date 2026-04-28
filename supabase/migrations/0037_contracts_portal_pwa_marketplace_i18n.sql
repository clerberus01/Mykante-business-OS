alter table public.organizations
add column if not exists default_locale text not null default 'pt-BR',
add column if not exists default_currency text not null default 'BRL',
add column if not exists portal_enabled boolean not null default true;

create unique index if not exists documents_id_org_unique_idx
on public.documents (id, organization_id);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'pending_signature', 'expired', 'cancelled', 'renewed')),
  contract_type text not null default 'service',
  amount numeric(12,2) not null default 0,
  currency text not null default 'BRL',
  starts_at date not null default current_date,
  ends_at date,
  renewal_interval text not null default 'none'
    check (renewal_interval in ('none', 'monthly', 'quarterly', 'yearly')),
  auto_renew boolean not null default false,
  renewal_notice_days integer not null default 30,
  next_renewal_at date,
  last_renewed_at timestamptz,
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint contracts_client_org_fk
    foreign key (client_id, organization_id)
    references public.clients(id, organization_id)
    on delete set null,
  constraint contracts_project_org_fk
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete set null,
  constraint contracts_document_org_fk
    foreign key (document_id, organization_id)
    references public.documents(id, organization_id)
    on delete set null,
  constraint contracts_dates_check
    check (ends_at is null or ends_at >= starts_at)
);

create index if not exists contracts_org_status_idx
on public.contracts (organization_id, status, updated_at desc)
where deleted_at is null;

create index if not exists contracts_org_client_idx
on public.contracts (organization_id, client_id, starts_at desc)
where deleted_at is null;

drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at
before update on public.contracts
for each row
execute function public.set_updated_at();

create table if not exists public.template_marketplace_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  template_type text not null check (template_type in ('proposal', 'checklist', 'workflow', 'project')),
  name text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  locale text not null default 'pt-BR',
  currency text not null default 'BRL',
  is_public boolean not null default false,
  install_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists template_marketplace_items_lookup_idx
on public.template_marketplace_items (template_type, is_public, locale, created_at desc);

drop trigger if exists set_template_marketplace_items_updated_at on public.template_marketplace_items;
create trigger set_template_marketplace_items_updated_at
before update on public.template_marketplace_items
for each row
execute function public.set_updated_at();

insert into public.template_marketplace_items (template_type, name, description, payload, locale, currency, is_public)
values
  ('proposal', 'Proposta de Servicos Recorrentes', 'Modelo base para contratos mensais com renovacao automatica.', '{"sections":["escopo","sla","mensalidade","renovacao"]}'::jsonb, 'pt-BR', 'BRL', true),
  ('checklist', 'Onboarding de Cliente', 'Checklist de implantacao e handoff comercial para projeto.', '{"items":["Kickoff","Acessos","Briefing","Cronograma","Primeira entrega"]}'::jsonb, 'pt-BR', 'BRL', true),
  ('workflow', 'Renovacao de Contrato', 'Fluxo para avisar gestor antes do vencimento e preparar renovacao.', '{"trigger":"contract_renewal_due","actions":["notify_manager","create_task"]}'::jsonb, 'pt-BR', 'BRL', true)
on conflict do nothing;

create or replace function public.calculate_contract_next_renewal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auto_renew = false or new.renewal_interval = 'none' then
    new.next_renewal_at := null;
    return new;
  end if;

  if new.ends_at is null then
    new.next_renewal_at := null;
    return new;
  end if;

  new.next_renewal_at := new.ends_at - make_interval(days => greatest(new.renewal_notice_days, 0));
  return new;
end;
$$;

drop trigger if exists calculate_contract_next_renewal on public.contracts;
create trigger calculate_contract_next_renewal
before insert or update of auto_renew, renewal_interval, ends_at, renewal_notice_days
on public.contracts
for each row
execute function public.calculate_contract_next_renewal();

revoke all on public.contracts from anon;
revoke all on public.template_marketplace_items from anon;
grant select, insert, update on public.contracts to authenticated;
grant select, insert, update on public.template_marketplace_items to authenticated;

alter table public.contracts enable row level security;
alter table public.contracts force row level security;
alter table public.template_marketplace_items enable row level security;
alter table public.template_marketplace_items force row level security;

drop policy if exists "contracts_select_org_members" on public.contracts;
create policy "contracts_select_org_members"
on public.contracts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "contracts_insert_managers" on public.contracts;
create policy "contracts_insert_managers"
on public.contracts
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "contracts_update_managers" on public.contracts;
create policy "contracts_update_managers"
on public.contracts
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "template_marketplace_select_allowed" on public.template_marketplace_items;
create policy "template_marketplace_select_allowed"
on public.template_marketplace_items
for select
to authenticated
using (is_public or (organization_id is not null and public.is_org_member(organization_id)));

drop policy if exists "template_marketplace_insert_admin" on public.template_marketplace_items;
create policy "template_marketplace_insert_admin"
on public.template_marketplace_items
for insert
to authenticated
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "template_marketplace_update_admin" on public.template_marketplace_items;
create policy "template_marketplace_update_admin"
on public.template_marketplace_items
for update
to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
