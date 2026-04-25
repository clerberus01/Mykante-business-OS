create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  table_name text not null,
  legal_basis text not null,
  retention_days integer not null check (retention_days >= 0),
  anonymize_after_days integer check (anonymize_after_days is null or anonymize_after_days >= retention_days),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, table_name)
);

create index if not exists data_retention_policies_org_idx
on public.data_retention_policies (organization_id, table_name);

drop trigger if exists set_data_retention_policies_updated_at on public.data_retention_policies;
create trigger set_data_retention_policies_updated_at
before update on public.data_retention_policies
for each row
execute function public.set_updated_at();

create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid references public.profiles(id) on delete set null,
  subject_type text not null check (subject_type in ('user', 'client', 'lead', 'contact')),
  subject_id uuid,
  subject_email text,
  request_type text not null check (request_type in ('confirm', 'access', 'correction', 'portability', 'anonymization', 'deletion', 'revocation')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  request_details text,
  response_summary text,
  due_at timestamptz not null default (timezone('utc', now()) + interval '15 days'),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint data_subject_requests_subject_presence check (subject_id is not null or subject_email is not null)
);

create index if not exists data_subject_requests_org_idx
on public.data_subject_requests (organization_id, created_at desc);

create index if not exists data_subject_requests_requester_idx
on public.data_subject_requests (requester_user_id, created_at desc);

drop trigger if exists set_data_subject_requests_updated_at on public.data_subject_requests;
create trigger set_data_subject_requests_updated_at
before update on public.data_subject_requests
for each row
execute function public.set_updated_at();

create or replace function public.export_current_user_personal_data()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with current_org as (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.status = 'active'
    order by om.created_at asc
    limit 1
  )
  select jsonb_build_object(
    'profile',
    (
      select to_jsonb(p)
      from public.profiles p
      where p.id = auth.uid()
    ),
    'organization',
    (
      select jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'lgpd_contact_email', o.lgpd_contact_email
      )
      from public.organizations o
      join current_org co on co.organization_id = o.id
    ),
    'notification_preferences',
    coalesce((
      select jsonb_agg(to_jsonb(np))
      from public.notification_preferences np
      join current_org co on co.organization_id = np.organization_id
      where np.user_id = auth.uid()
    ), '[]'::jsonb),
    'notification_subscriptions',
    coalesce((
      select jsonb_agg(to_jsonb(ns))
      from public.notification_subscriptions ns
      join current_org co on co.organization_id = ns.organization_id
      where ns.user_id = auth.uid()
    ), '[]'::jsonb),
    'consents',
    coalesce((
      select jsonb_agg(to_jsonb(c))
      from public.consents c
      join current_org co on co.organization_id = c.organization_id
      where c.subject_type = 'user'
        and c.subject_id = auth.uid()
    ), '[]'::jsonb),
    'dispatches',
    coalesce((
      select jsonb_agg(to_jsonb(d))
      from public.notification_dispatches d
      join current_org co on co.organization_id = d.organization_id
      where d.user_id = auth.uid()
    ), '[]'::jsonb),
    'requests',
    coalesce((
      select jsonb_agg(to_jsonb(r))
      from public.data_subject_requests r
      join current_org co on co.organization_id = r.organization_id
      where r.requester_user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

revoke all on public.data_retention_policies from anon;
revoke all on public.data_subject_requests from anon;

grant select on public.data_retention_policies to authenticated;
grant select, insert on public.data_subject_requests to authenticated;
grant update on public.data_subject_requests to authenticated;
grant execute on function public.export_current_user_personal_data() to authenticated;

alter table public.data_retention_policies enable row level security;
alter table public.data_subject_requests enable row level security;

alter table public.data_retention_policies force row level security;
alter table public.data_subject_requests force row level security;

drop policy if exists "data_retention_policies_select_manager" on public.data_retention_policies;
create policy "data_retention_policies_select_manager"
on public.data_retention_policies
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "data_subject_requests_select_self_or_manager" on public.data_subject_requests;
create policy "data_subject_requests_select_self_or_manager"
on public.data_subject_requests
for select
to authenticated
using (
  requester_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "data_subject_requests_insert_self_or_manager" on public.data_subject_requests;
create policy "data_subject_requests_insert_self_or_manager"
on public.data_subject_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "data_subject_requests_update_manager" on public.data_subject_requests;
create policy "data_subject_requests_update_manager"
on public.data_subject_requests
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

insert into public.data_retention_policies (
  organization_id,
  table_name,
  legal_basis,
  retention_days,
  anonymize_after_days,
  notes
)
select
  o.id,
  policy.table_name,
  policy.legal_basis,
  policy.retention_days,
  policy.anonymize_after_days,
  policy.notes
from public.organizations o
cross join (
  values
    ('clients', 'contract', 1825, 2190, 'Dados cadastrais de clientes ativos e historico contratual.'),
    ('transactions', 'legal_obligation', 3650, null, 'Registros financeiros e obrigacoes contabil-fiscais.'),
    ('documents', 'contract', 1825, 2190, 'Arquivos operacionais e comprovacoes vinculadas ao atendimento.'),
    ('notification_dispatches', 'legitimate_interest', 365, 730, 'Historico minimo para auditoria de comunicacoes.'),
    ('audit_logs', 'legal_obligation', 3650, null, 'Trilha de auditoria e seguranca operacional.')
) as policy(table_name, legal_basis, retention_days, anonymize_after_days, notes)
on conflict (organization_id, table_name) do nothing;
