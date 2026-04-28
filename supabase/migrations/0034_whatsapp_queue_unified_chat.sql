-- WhatsApp roadmap foundation: unified channels, official templates, retry queue,
-- auto-classification and direct customer/project timeline linkage.

create table if not exists public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  meta_template_name text not null,
  language_code text not null default 'pt_BR',
  category text not null default 'utility' check (category in ('utility', 'marketing', 'authentication')),
  body_preview text not null,
  variables jsonb not null default '[]'::jsonb,
  status text not null default 'approved' check (status in ('approved', 'paused', 'rejected', 'draft')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, template_key)
);

alter table public.whatsapp_conversations
add column if not exists channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'email', 'sms')),
add column if not exists category text not null default 'opportunity'
  check (category in ('opportunity', 'support', 'billing')),
add column if not exists project_id uuid,
add column if not exists classification_confidence numeric(4,3) not null default 0,
add column if not exists last_classified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_conversations_project_fk'
      and conrelid = 'public.whatsapp_conversations'::regclass
  ) then
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_project_fk
      foreign key (project_id, organization_id)
      references public.projects(id, organization_id)
      on delete set null;
  end if;
end $$;

alter table public.whatsapp_messages
add column if not exists channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'email', 'sms')),
add column if not exists template_id uuid references public.whatsapp_message_templates(id) on delete set null,
add column if not exists template_payload jsonb,
add column if not exists queued_at timestamptz not null default timezone('utc', now()),
add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
add column if not exists max_retries integer not null default 3 check (max_retries >= 0),
add column if not exists next_attempt_at timestamptz not null default timezone('utc', now()),
add column if not exists last_attempt_at timestamptz;

create index if not exists whatsapp_messages_queue_idx
on public.whatsapp_messages (organization_id, next_attempt_at asc)
where direction = 'outbound'
  and status in ('queued', 'failed');

create index if not exists whatsapp_conversations_org_category_idx
on public.whatsapp_conversations (organization_id, category, updated_at desc);

create index if not exists whatsapp_templates_org_status_idx
on public.whatsapp_message_templates (organization_id, status, template_key);

drop trigger if exists set_whatsapp_message_templates_updated_at on public.whatsapp_message_templates;
create trigger set_whatsapp_message_templates_updated_at
before update on public.whatsapp_message_templates
for each row
execute function public.set_updated_at();

create or replace function public.ensure_default_whatsapp_templates(org_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.whatsapp_message_templates (
    organization_id,
    template_key,
    meta_template_name,
    language_code,
    category,
    body_preview,
    variables,
    status
  )
  values
    (
      org_id,
      'proposal_accepted',
      'proposal_accepted_ptbr',
      'pt_BR',
      'utility',
      'Sua proposta foi aceita. Iniciamos o projeto e manteremos voce atualizado por aqui.',
      '[]'::jsonb,
      'approved'
    ),
    (
      org_id,
      'payment_reminder',
      'payment_reminder_ptbr',
      'pt_BR',
      'utility',
      'Olá, identificamos uma cobrança pendente. Posso te enviar os detalhes?',
      '[]'::jsonb,
      'approved'
    ),
    (
      org_id,
      'support_follow_up',
      'support_follow_up_ptbr',
      'pt_BR',
      'utility',
      'Estamos acompanhando sua solicitação de suporte e retornaremos com a atualização.',
      '[]'::jsonb,
      'approved'
    )
  on conflict (organization_id, template_key) do nothing;
$$;

select public.ensure_default_whatsapp_templates(id)
from public.organizations;

create or replace function public.classify_conversation_text(message_body text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(message_body, '') ~* '(boleto|pix|pagamento|cobranca|cobrança|fatura|nota fiscal|recibo|vencid|pagar|valor)' then 'billing'
    when coalesce(message_body, '') ~* '(erro|bug|problema|suporte|ajuda|travou|nao funciona|não funciona|duvida|dúvida)' then 'support'
    else 'opportunity'
  end;
$$;

create or replace function public.classify_whatsapp_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_category text;
begin
  next_category := public.classify_conversation_text(new.last_message_body);

  new.category := next_category;
  new.classification_confidence := case next_category
    when 'opportunity' then 0.65
    else 0.9
  end;
  new.last_classified_at := timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists classify_whatsapp_conversation on public.whatsapp_conversations;
create trigger classify_whatsapp_conversation
before insert or update of last_message_body on public.whatsapp_conversations
for each row
execute function public.classify_whatsapp_conversation();

create or replace function public.log_communication_message_to_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation public.whatsapp_conversations%rowtype;
begin
  select *
  into target_conversation
  from public.whatsapp_conversations
  where id = new.conversation_id
    and organization_id = new.organization_id;

  if target_conversation.client_id is not null then
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
      target_conversation.client_id,
      'whatsapp',
      case when new.direction = 'inbound' then 'WhatsApp recebido' else 'WhatsApp enviado' end,
      new.body,
      jsonb_build_object(
        'messageId', new.id,
        'conversationId', new.conversation_id,
        'channel', new.channel,
        'category', target_conversation.category,
        'status', new.status
      ),
      coalesce(new.sent_by::text, 'system'),
      new.created_at
    )
    on conflict do nothing;
  end if;

  if target_conversation.project_id is not null then
    insert into public.project_activity (
      organization_id,
      project_id,
      user_id,
      user_name,
      action,
      details,
      timestamp
    )
    values (
      new.organization_id,
      target_conversation.project_id,
      coalesce(new.sent_by::text, 'system'),
      'Comunicacao',
      'Mensagem ' || upper(new.channel),
      left(new.body, 500),
      new.created_at
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_communication_message_to_timeline on public.whatsapp_messages;
create trigger log_communication_message_to_timeline
after insert on public.whatsapp_messages
for each row
execute function public.log_communication_message_to_timeline();

revoke all on public.whatsapp_message_templates from anon;
grant select, insert, update on public.whatsapp_message_templates to authenticated;

alter table public.whatsapp_message_templates enable row level security;
alter table public.whatsapp_message_templates force row level security;

drop policy if exists "whatsapp_templates_select_org_members" on public.whatsapp_message_templates;
create policy "whatsapp_templates_select_org_members"
on public.whatsapp_message_templates
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "whatsapp_templates_insert_admin" on public.whatsapp_message_templates;
create policy "whatsapp_templates_insert_admin"
on public.whatsapp_message_templates
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "whatsapp_templates_update_admin" on public.whatsapp_message_templates;
create policy "whatsapp_templates_update_admin"
on public.whatsapp_message_templates
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_conversations force row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_messages force row level security;
