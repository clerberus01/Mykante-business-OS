create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid,
  contact_name text not null,
  phone_e164 text not null,
  status text not null default 'open' check (status in ('open', 'archived')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_body text,
  last_message_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint whatsapp_conversations_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null
);

create unique index if not exists whatsapp_conversations_org_phone_unique_idx
on public.whatsapp_conversations (organization_id, phone_e164);

create index if not exists whatsapp_conversations_org_last_message_idx
on public.whatsapp_conversations (organization_id, last_message_at desc nulls last);

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row
execute function public.set_updated_at();

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'received', 'failed')),
  provider_message_id text,
  error_message text,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);

create index if not exists whatsapp_messages_conversation_created_idx
on public.whatsapp_messages (conversation_id, created_at asc);

create index if not exists whatsapp_messages_provider_message_idx
on public.whatsapp_messages (provider_message_id)
where provider_message_id is not null;

create unique index if not exists whatsapp_messages_provider_message_unique_idx
on public.whatsapp_messages (organization_id, provider_message_id)
where provider_message_id is not null;

revoke all on public.whatsapp_conversations from anon;
revoke all on public.whatsapp_messages from anon;

grant select, insert, update on public.whatsapp_conversations to authenticated;
grant select on public.whatsapp_messages to authenticated;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

alter table public.whatsapp_conversations force row level security;
alter table public.whatsapp_messages force row level security;

drop policy if exists "whatsapp_conversations_select_org_members" on public.whatsapp_conversations;
create policy "whatsapp_conversations_select_org_members"
on public.whatsapp_conversations
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "whatsapp_conversations_insert_org_members" on public.whatsapp_conversations;
create policy "whatsapp_conversations_insert_org_members"
on public.whatsapp_conversations
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "whatsapp_conversations_update_org_members" on public.whatsapp_conversations;
create policy "whatsapp_conversations_update_org_members"
on public.whatsapp_conversations
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "whatsapp_messages_select_org_members" on public.whatsapp_messages;
create policy "whatsapp_messages_select_org_members"
on public.whatsapp_messages
for select
to authenticated
using (public.is_org_member(organization_id));
