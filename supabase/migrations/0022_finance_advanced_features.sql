create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type text not null default 'both' check (type in ('income', 'expense', 'both')),
  dre_group text not null default 'operational',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, name)
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, name)
);

alter table public.transactions
add column if not exists cost_center_id uuid references public.cost_centers(id) on delete set null,
add column if not exists payment_provider text check (payment_provider in ('pagseguro', 'manual')),
add column if not exists payment_method text check (payment_method in ('pix', 'boleto')),
add column if not exists payment_url text,
add column if not exists provider_payment_id text,
add column if not exists bank_statement_line_id uuid;

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_id uuid references public.bank_statement_imports(id) on delete cascade,
  occurred_at timestamptz not null,
  description text not null,
  amount numeric(12,2) not null,
  matched_transaction_id uuid references public.transactions(id) on delete set null,
  match_confidence numeric(5,2),
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  provider text not null default 'pagseguro',
  method text not null check (method in ('pix', 'boleto')),
  status text not null default 'created' check (status in ('created', 'sent', 'paid', 'failed')),
  payment_url text,
  provider_payment_id text,
  payload jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists finance_categories_org_idx on public.finance_categories(organization_id, active);
create index if not exists cost_centers_org_idx on public.cost_centers(organization_id, active);
create index if not exists bank_statement_lines_org_idx on public.bank_statement_lines(organization_id, occurred_at desc);
create index if not exists payment_requests_org_idx on public.payment_requests(organization_id, created_at desc);

alter table public.finance_categories enable row level security;
alter table public.cost_centers enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.payment_requests enable row level security;

drop policy if exists "finance_categories_org_members" on public.finance_categories;
create policy "finance_categories_org_members" on public.finance_categories for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "cost_centers_org_members" on public.cost_centers;
create policy "cost_centers_org_members" on public.cost_centers for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "bank_statement_imports_org_members" on public.bank_statement_imports;
create policy "bank_statement_imports_org_members" on public.bank_statement_imports for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "bank_statement_lines_org_members" on public.bank_statement_lines;
create policy "bank_statement_lines_org_members" on public.bank_statement_lines for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "payment_requests_org_members" on public.payment_requests;
create policy "payment_requests_org_members" on public.payment_requests for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

insert into public.finance_categories (organization_id, name, type, dre_group)
select id, seed.name, seed.type, seed.dre_group
from public.organizations
cross join (
  values
    ('Servicos', 'income', 'gross_revenue'),
    ('Assinaturas', 'income', 'gross_revenue'),
    ('Impostos', 'expense', 'taxes'),
    ('Salarios', 'expense', 'people'),
    ('Ferramentas', 'expense', 'operations'),
    ('Marketing', 'expense', 'sales'),
    ('Software', 'expense', 'operations'),
    ('Outros', 'both', 'operational')
) as seed(name, type, dre_group)
on conflict (organization_id, name) do nothing;

insert into public.cost_centers (organization_id, name, code)
select id, 'Operacional', 'OPS'
from public.organizations
on conflict (organization_id, name) do nothing;
