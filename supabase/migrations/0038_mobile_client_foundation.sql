alter table public.clients
add column if not exists source text not null default 'web',
add column if not exists created_from_mobile boolean not null default false,
add column if not exists whatsapp_opt_in boolean not null default true,
add column if not exists responsible_id uuid references public.profiles(id) on delete set null,
add column if not exists segment text,
add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create index if not exists clients_org_source_idx
on public.clients (organization_id, source, created_at desc)
where deleted_at is null;

create index if not exists clients_org_responsible_idx
on public.clients (organization_id, responsible_id)
where deleted_at is null and responsible_id is not null;

create index if not exists clients_org_segment_idx
on public.clients (organization_id, segment)
where deleted_at is null and segment is not null;

create index if not exists clients_custom_fields_gin_idx
on public.clients using gin (custom_fields);

create or replace function public.mark_client_mobile_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_from_mobile := coalesce(new.created_from_mobile, false) or new.source = 'mobile';
  return new;
end;
$$;

drop trigger if exists mark_client_mobile_source on public.clients;
create trigger mark_client_mobile_source
before insert or update of source, created_from_mobile on public.clients
for each row
execute function public.mark_client_mobile_source();

alter table public.whatsapp_conversations
add column if not exists suggested_client_status text not null default 'none'
  check (suggested_client_status in ('none', 'pending', 'created', 'dismissed')),
add column if not exists suggested_client_payload jsonb not null default '{}'::jsonb;

create index if not exists whatsapp_conversations_org_suggested_client_idx
on public.whatsapp_conversations (organization_id, suggested_client_status, updated_at desc)
where suggested_client_status <> 'none';
