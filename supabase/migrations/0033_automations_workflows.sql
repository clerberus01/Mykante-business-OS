-- Simple no-code automations foundation.
-- Rules are organization-scoped and executions are logged/idempotent.

alter table public.proposals
add column if not exists payment_status text not null default 'pending'
check (payment_status in ('pending', 'paid'));

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_key text not null check (
    rule_key in (
      'proposal_accepted_create_project',
      'task_overdue_follow_up',
      'payment_received_mark_paid'
    )
  ),
  name text not null,
  description text,
  trigger_key text not null,
  is_active boolean not null default true,
  actions jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, rule_key)
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  rule_key text not null,
  event_source text not null,
  event_id text not null,
  status text not null default 'success' check (status in ('success', 'skipped', 'failed')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, rule_key, event_source, event_id)
);

create index if not exists automation_rules_org_active_idx
on public.automation_rules (organization_id, is_active, rule_key);

create index if not exists automation_runs_org_created_idx
on public.automation_runs (organization_id, created_at desc);

drop trigger if exists set_automation_rules_updated_at on public.automation_rules;
create trigger set_automation_rules_updated_at
before update on public.automation_rules
for each row
execute function public.set_updated_at();

create or replace function public.ensure_default_automation_rules(org_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.automation_rules (
    organization_id,
    rule_key,
    name,
    description,
    trigger_key,
    actions
  )
  values
    (
      org_id,
      'proposal_accepted_create_project',
      'Proposta aceita -> Criar projeto',
      'Cria projeto, tarefa de kickoff e mensagem WhatsApp em fila quando uma proposta muda para aceita.',
      'proposal.status.accepted',
      '[
        {"type":"create_project","label":"Criar projeto automaticamente"},
        {"type":"assign_owner","label":"Atribuir responsavel inicial"},
        {"type":"queue_whatsapp","label":"Enviar template WhatsApp para acompanhamento"}
      ]'::jsonb
    ),
    (
      org_id,
      'task_overdue_follow_up',
      'Tarefa atrasada -> Follow-up',
      'Notifica gestores e move oportunidade aberta do cliente para follow-up quando tarefas vencidas sao varridas.',
      'task.due_date.overdue',
      '[
        {"type":"notify_managers","label":"Notificar gestores"},
        {"type":"move_pipeline","label":"Mover pipeline para follow-up"}
      ]'::jsonb
    ),
    (
      org_id,
      'payment_received_mark_paid',
      'Pagamento recebido -> Marcar proposta paga',
      'Marca propostas aceitas como pagas quando um recebimento compatível e liquidado e identificado.',
      'transaction.status.liquidated',
      '[
        {"type":"mark_proposal_paid","label":"Marcar proposta como paga"},
        {"type":"log_receipt","label":"Registrar recibo operacional"}
      ]'::jsonb
    )
  on conflict (organization_id, rule_key) do nothing;
$$;

create or replace function public.ensure_default_automation_rules_for_new_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_automation_rules(new.id);
  return new;
end;
$$;

drop trigger if exists ensure_default_automation_rules_for_new_org on public.organizations;
create trigger ensure_default_automation_rules_for_new_org
after insert on public.organizations
for each row
execute function public.ensure_default_automation_rules_for_new_org();

select public.ensure_default_automation_rules(id)
from public.organizations;

create or replace function public.run_proposal_accepted_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_rule public.automation_rules%rowtype;
  target_client public.clients%rowtype;
  assignee_id uuid;
  assignee_name text;
  next_project_id uuid;
  next_milestone_id uuid;
  next_conversation_id uuid;
  normalized_phone text;
  run_id uuid;
begin
  if new.status <> 'accepted' or (tg_op = 'UPDATE' and old.status = 'accepted') then
    return new;
  end if;

  select *
  into target_rule
  from public.automation_rules
  where organization_id = new.organization_id
    and rule_key = 'proposal_accepted_create_project'
    and is_active = true
  limit 1;

  if target_rule.id is null then
    return new;
  end if;

  insert into public.automation_runs (
    organization_id,
    rule_id,
    rule_key,
    event_source,
    event_id,
    status,
    details
  )
  values (
    new.organization_id,
    target_rule.id,
    target_rule.rule_key,
    'proposals',
    new.id::text,
    'success',
    jsonb_build_object('proposalId', new.id)
  )
  on conflict (organization_id, rule_key, event_source, event_id) do nothing
  returning id into run_id;

  if run_id is null then
    return new;
  end if;

  select *
  into target_client
  from public.clients
  where id = new.client_id
    and organization_id = new.organization_id;

  select om.user_id, coalesce(p.full_name, p.email, 'Responsavel')
  into assignee_id, assignee_name
  from public.organization_members om
  left join public.profiles p on p.id = om.user_id
  where om.organization_id = new.organization_id
    and om.status = 'active'
    and om.role in ('owner', 'admin', 'manager')
  order by case om.role when 'owner' then 1 when 'admin' then 2 else 3 end, om.created_at
  limit 1;

  insert into public.projects (
    organization_id,
    client_id,
    name,
    description,
    status,
    start_date,
    deadline,
    budget,
    payment_status,
    progress,
    created_by
  )
  values (
    new.organization_id,
    new.client_id,
    'Projeto - ' || new.title,
    coalesce(new.description, 'Projeto criado automaticamente a partir da proposta aceita.'),
    'ongoing',
    timezone('utc', now()),
    timezone('utc', now()) + interval '30 days',
    new.value,
    'pending',
    0,
    coalesce(assignee_id, new.created_by)
  )
  returning id into next_project_id;

  insert into public.milestones (
    organization_id,
    project_id,
    title,
    sort_order,
    status,
    created_by
  )
  values (
    new.organization_id,
    next_project_id,
    'Kickoff',
    10,
    'pending',
    coalesce(assignee_id, new.created_by)
  )
  returning id into next_milestone_id;

  insert into public.tasks (
    organization_id,
    project_id,
    milestone_id,
    title,
    description,
    status,
    priority,
    responsible,
    responsible_id,
    due_date,
    created_by
  )
  values (
    new.organization_id,
    next_project_id,
    next_milestone_id,
    'Preparar kickoff do projeto',
    'Tarefa criada pela automacao de proposta aceita.',
    'todo',
    'high',
    coalesce(assignee_name, 'Equipe'),
    assignee_id,
    timezone('utc', now()) + interval '2 days',
    coalesce(assignee_id, new.created_by)
  );

  insert into public.project_activity (
    organization_id,
    project_id,
    user_id,
    user_name,
    action,
    details
  )
  values (
    new.organization_id,
    next_project_id,
    coalesce(assignee_id::text, 'automation'),
    coalesce(assignee_name, 'Automations'),
    'Automacao',
    'Projeto criado automaticamente a partir da proposta aceita.'
  );

  normalized_phone := regexp_replace(coalesce(target_client.phone, target_client.contact_phone, ''), '[^0-9+]', '', 'g');

  if normalized_phone <> '' then
    insert into public.whatsapp_conversations (
      organization_id,
      client_id,
      contact_name,
      phone_e164,
      status,
      last_message_body,
      last_message_at,
      created_by
    )
    values (
      new.organization_id,
      new.client_id,
      coalesce(target_client.contact_name, target_client.name, 'Cliente'),
      normalized_phone,
      'open',
      'Sua proposta foi aceita. Iniciamos o projeto e manteremos voce atualizado por aqui.',
      timezone('utc', now()),
      coalesce(assignee_id, new.created_by)
    )
    on conflict (organization_id, phone_e164) do update
    set
      status = 'open',
      client_id = coalesce(public.whatsapp_conversations.client_id, excluded.client_id),
      last_message_body = excluded.last_message_body,
      last_message_at = excluded.last_message_at
    returning id into next_conversation_id;

    insert into public.whatsapp_messages (
      organization_id,
      conversation_id,
      direction,
      body,
      status,
      sent_by
    )
    values (
      new.organization_id,
      next_conversation_id,
      'outbound',
      'Sua proposta foi aceita. Iniciamos o projeto e manteremos voce atualizado por aqui.',
      'queued',
      coalesce(assignee_id, new.created_by)
    );
  end if;

  update public.automation_runs
  set details = details || jsonb_build_object('projectId', next_project_id, 'conversationId', next_conversation_id)
  where id = run_id;

  return new;
end;
$$;

drop trigger if exists run_proposal_accepted_automation on public.proposals;
create trigger run_proposal_accepted_automation
after insert or update of status on public.proposals
for each row
execute function public.run_proposal_accepted_automation();

create or replace function public.run_payment_received_automation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_rule public.automation_rules%rowtype;
  updated_count integer := 0;
begin
  if new.type <> 'income'
    or new.status <> 'liquidated'
    or (tg_op = 'UPDATE' and old.status = 'liquidated') then
    return new;
  end if;

  select *
  into target_rule
  from public.automation_rules
  where organization_id = new.organization_id
    and rule_key = 'payment_received_mark_paid'
    and is_active = true
  limit 1;

  if target_rule.id is null then
    return new;
  end if;

  update public.proposals p
  set payment_status = 'paid'
  where p.organization_id = new.organization_id
    and p.status = 'accepted'
    and p.payment_status <> 'paid'
    and p.client_id = new.client_id
    and abs(p.value - new.amount) < 0.01;

  get diagnostics updated_count = row_count;

  insert into public.automation_runs (
    organization_id,
    rule_id,
    rule_key,
    event_source,
    event_id,
    status,
    details
  )
  values (
    new.organization_id,
    target_rule.id,
    target_rule.rule_key,
    'transactions',
    new.id::text,
    case when updated_count > 0 then 'success' else 'skipped' end,
    jsonb_build_object('transactionId', new.id, 'paidProposals', updated_count)
  )
  on conflict (organization_id, rule_key, event_source, event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists run_payment_received_automation on public.transactions;
create trigger run_payment_received_automation
after insert or update of status on public.transactions
for each row
execute function public.run_payment_received_automation();

create or replace function public.run_overdue_task_automations(org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_rule public.automation_rules%rowtype;
  overdue_task record;
  follow_up_stage_id uuid;
  manager record;
  processed_count integer := 0;
  event_key text;
begin
  if not public.is_org_member(org_id) then
    raise exception 'Not authorized to run automations for this organization.';
  end if;

  select *
  into target_rule
  from public.automation_rules
  where organization_id = org_id
    and rule_key = 'task_overdue_follow_up'
    and is_active = true
  limit 1;

  if target_rule.id is null then
    return 0;
  end if;

  insert into public.crm_pipeline_stages (
    organization_id,
    key,
    name,
    position,
    color,
    is_default
  )
  values (
    org_id,
    'follow_up',
    'Follow-up',
    90,
    '#F59E0B',
    false
  )
  on conflict (organization_id, key) do update
  set name = excluded.name
  returning id into follow_up_stage_id;

  for overdue_task in
    select
      t.id as task_id,
      t.title as task_title,
      t.project_id,
      t.due_date,
      p.name as project_name,
      p.client_id
    from public.tasks t
    join public.projects p on p.id = t.project_id and p.organization_id = t.organization_id
    where t.organization_id = org_id
      and t.status <> 'done'
      and t.due_date is not null
      and t.due_date < timezone('utc', now())
  loop
    event_key := overdue_task.task_id::text || ':' || current_date::text;

    insert into public.automation_runs (
      organization_id,
      rule_id,
      rule_key,
      event_source,
      event_id,
      status,
      details
    )
    values (
      org_id,
      target_rule.id,
      target_rule.rule_key,
      'tasks',
      event_key,
      'success',
      jsonb_build_object(
        'taskId', overdue_task.task_id,
        'projectId', overdue_task.project_id,
        'dueDate', overdue_task.due_date
      )
    )
    on conflict (organization_id, rule_key, event_source, event_id) do nothing;

    if not found then
      continue;
    end if;

    update public.crm_deals
    set stage_id = follow_up_stage_id
    where organization_id = org_id
      and client_id = overdue_task.client_id
      and status = 'open';

    insert into public.project_activity (
      organization_id,
      project_id,
      user_id,
      user_name,
      action,
      details
    )
    values (
      org_id,
      overdue_task.project_id,
      auth.uid()::text,
      'Automations',
      'Follow-up',
      'Tarefa atrasada detectada: ' || overdue_task.task_title
    );

    for manager in
      select om.user_id
      from public.organization_members om
      where om.organization_id = org_id
        and om.status = 'active'
        and om.role in ('owner', 'admin', 'manager')
    loop
      insert into public.notification_dispatches (
        organization_id,
        user_id,
        channel,
        provider,
        template_key,
        payload
      )
      values (
        org_id,
        manager.user_id,
        'push',
        'onesignal',
        'automation_task_overdue',
        jsonb_build_object(
          'taskId', overdue_task.task_id,
          'taskTitle', overdue_task.task_title,
          'projectId', overdue_task.project_id,
          'projectName', overdue_task.project_name
        )
      );
    end loop;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on public.automation_rules from anon;
revoke all on public.automation_runs from anon;
grant select, insert, update on public.automation_rules to authenticated;
grant select on public.automation_runs to authenticated;
grant execute on function public.run_overdue_task_automations(uuid) to authenticated;

alter table public.automation_rules enable row level security;
alter table public.automation_rules force row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_runs force row level security;

drop policy if exists "automation_rules_select_org_members" on public.automation_rules;
create policy "automation_rules_select_org_members"
on public.automation_rules
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "automation_rules_insert_admin" on public.automation_rules;
create policy "automation_rules_insert_admin"
on public.automation_rules
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "automation_rules_update_admin" on public.automation_rules;
create policy "automation_rules_update_admin"
on public.automation_rules
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "automation_runs_select_org_members" on public.automation_runs;
create policy "automation_runs_select_org_members"
on public.automation_runs
for select
to authenticated
using (public.is_org_member(organization_id));
