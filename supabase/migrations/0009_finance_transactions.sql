create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null,
  date timestamptz not null,
  due_date timestamptz not null,
  status text not null check (status in ('pending', 'liquidated', 'cancelled')),
  category_id text not null,
  client_id uuid,
  project_id uuid,
  is_recurring boolean not null default false,
  recurrence_interval text check (recurrence_interval in ('monthly', 'weekly', 'yearly')),
  attachment_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint transactions_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint transactions_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete set null
);

create index if not exists transactions_org_date_idx
on public.transactions (organization_id, date desc);

create index if not exists transactions_org_status_idx
on public.transactions (organization_id, status);

create index if not exists transactions_org_type_idx
on public.transactions (organization_id, type);

create index if not exists transactions_org_client_idx
on public.transactions (organization_id, client_id);

create index if not exists transactions_org_project_idx
on public.transactions (organization_id, project_id);

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

revoke all on public.transactions from anon;
grant select, insert, update on public.transactions to authenticated;

alter table public.transactions enable row level security;
alter table public.transactions force row level security;

drop policy if exists "transactions_select_org_members" on public.transactions;
create policy "transactions_select_org_members"
on public.transactions
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "transactions_insert_org_members" on public.transactions;
create policy "transactions_insert_org_members"
on public.transactions
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "transactions_update_org_members" on public.transactions;
create policy "transactions_update_org_members"
on public.transactions
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "transactions_delete_none" on public.transactions;
create policy "transactions_delete_none"
on public.transactions
for delete
to authenticated
using (false);
