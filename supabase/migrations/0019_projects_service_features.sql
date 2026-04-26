alter table public.project_time_entries
add column if not exists billable boolean not null default true,
add column if not exists hourly_rate numeric(12,2),
add column if not exists billed_amount numeric(12,2),
add column if not exists billed_transaction_id uuid references public.transactions(id) on delete set null;

alter table public.milestones
add column if not exists approval_status text not null default 'not_requested'
  check (approval_status in ('not_requested', 'requested', 'approved', 'rejected')),
add column if not exists approval_token text,
add column if not exists approval_requested_at timestamptz,
add column if not exists approval_responded_at timestamptz,
add column if not exists approval_url text;

create unique index if not exists milestones_approval_token_idx
on public.milestones (approval_token)
where approval_token is not null;

create table if not exists public.project_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  estimated_days integer not null default 30,
  default_budget numeric(12,2),
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_template_milestones (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0
);

create table if not exists public.project_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_milestone_id uuid not null references public.project_template_milestones(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  sort_order integer not null default 0
);

create index if not exists project_templates_org_idx
on public.project_templates (organization_id, created_at desc);

create index if not exists project_template_milestones_template_idx
on public.project_template_milestones (template_id, sort_order);

create index if not exists project_template_tasks_milestone_idx
on public.project_template_tasks (template_milestone_id, sort_order);

drop trigger if exists set_project_templates_updated_at on public.project_templates;
create trigger set_project_templates_updated_at
before update on public.project_templates
for each row
execute function public.set_updated_at();

alter table public.project_templates enable row level security;
alter table public.project_template_milestones enable row level security;
alter table public.project_template_tasks enable row level security;

drop policy if exists "project_templates_select_org_or_system" on public.project_templates;
create policy "project_templates_select_org_or_system"
on public.project_templates
for select
to authenticated
using (is_system or public.is_org_member(organization_id));

drop policy if exists "project_templates_insert_admin" on public.project_templates;
create policy "project_templates_insert_admin"
on public.project_templates
for insert
to authenticated
with check (
  organization_id is not null
  and public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "project_templates_update_admin" on public.project_templates;
create policy "project_templates_update_admin"
on public.project_templates
for update
to authenticated
using (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (organization_id is not null and public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "project_template_milestones_select_allowed" on public.project_template_milestones;
create policy "project_template_milestones_select_allowed"
on public.project_template_milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.project_templates pt
    where pt.id = project_template_milestones.template_id
      and (pt.is_system or public.is_org_member(pt.organization_id))
  )
);

drop policy if exists "project_template_tasks_select_allowed" on public.project_template_tasks;
create policy "project_template_tasks_select_allowed"
on public.project_template_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.project_template_milestones pm
    join public.project_templates pt on pt.id = pm.template_id
    where pm.id = project_template_tasks.template_milestone_id
      and (pt.is_system or public.is_org_member(pt.organization_id))
  )
);

create or replace function public.bill_project_time_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project public.projects%rowtype;
  amount_to_bill numeric(12,2);
  transaction_id uuid;
begin
  if new.stopped_at is null
    or coalesce(new.billable, true) = false
    or coalesce(new.hourly_rate, 0) <= 0
    or new.billed_transaction_id is not null then
    return new;
  end if;

  amount_to_bill := round((coalesce(new.duration_minutes, 0)::numeric / 60) * new.hourly_rate, 2);

  if amount_to_bill <= 0 then
    return new;
  end if;

  select *
  into target_project
  from public.projects
  where id = new.project_id
    and organization_id = new.organization_id;

  insert into public.transactions (
    organization_id,
    type,
    amount,
    description,
    date,
    due_date,
    status,
    category_id,
    client_id,
    project_id,
    created_by
  )
  values (
    new.organization_id,
    'income',
    amount_to_bill,
    'Faturamento automatico de horas do projeto: ' || coalesce(target_project.name, new.project_id::text),
    timezone('utc', now()),
    timezone('utc', now()) + interval '7 days',
    'pending',
    'service_hours',
    target_project.client_id,
    new.project_id,
    new.user_id
  )
  returning id into transaction_id;

  new.billed_amount := amount_to_bill;
  new.billed_transaction_id := transaction_id;

  return new;
end;
$$;

drop trigger if exists bill_project_time_entry on public.project_time_entries;
create trigger bill_project_time_entry
before update of stopped_at, duration_minutes, hourly_rate, billable on public.project_time_entries
for each row
execute function public.bill_project_time_entry();

insert into public.project_templates (id, organization_id, name, description, estimated_days, default_budget, is_system)
values
  ('00000000-0000-0000-0000-000000000201', null, 'Implantacao Padrao', 'Template de implantacao com briefing, execucao, revisao e entrega.', 30, null, true),
  ('00000000-0000-0000-0000-000000000202', null, 'Projeto Recorrente Mensal', 'Template para operacoes mensais com planejamento, producao, revisao e relatorio.', 30, null, true)
on conflict (id) do nothing;

insert into public.project_template_milestones (id, template_id, title, sort_order)
values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000000201', 'Briefing e Diagnostico', 10),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000000201', 'Execucao', 20),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000000201', 'Revisao e Entrega', 30),
  ('00000000-0000-0000-0000-000000001204', '00000000-0000-0000-0000-000000000202', 'Planejamento Mensal', 10),
  ('00000000-0000-0000-0000-000000001205', '00000000-0000-0000-0000-000000000202', 'Producao e Operacao', 20),
  ('00000000-0000-0000-0000-000000001206', '00000000-0000-0000-0000-000000000202', 'Relatorio e Otimizacao', 30)
on conflict (id) do nothing;

insert into public.project_template_tasks (template_milestone_id, title, description, priority, sort_order)
values
  ('00000000-0000-0000-0000-000000001201', 'Coletar briefing', 'Registrar objetivos, restricoes e materiais do cliente.', 'high', 10),
  ('00000000-0000-0000-0000-000000001201', 'Validar escopo', 'Confirmar entregaveis, prazos e criterios de sucesso.', 'high', 20),
  ('00000000-0000-0000-0000-000000001202', 'Executar entregaveis principais', 'Produzir os itens aprovados no escopo.', 'medium', 10),
  ('00000000-0000-0000-0000-000000001203', 'Enviar para aprovacao', 'Compartilhar status e solicitar aceite final.', 'high', 10),
  ('00000000-0000-0000-0000-000000001204', 'Montar plano mensal', 'Definir prioridades, agenda e capacidade do mes.', 'high', 10),
  ('00000000-0000-0000-0000-000000001205', 'Executar rotina operacional', 'Registrar tarefas recorrentes e horas billable.', 'medium', 10),
  ('00000000-0000-0000-0000-000000001206', 'Gerar relatorio de status', 'Consolidar resultados, horas e proximas acoes.', 'medium', 10);
