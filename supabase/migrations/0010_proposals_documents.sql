create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  title text not null,
  value numeric(12,2) not null default 0,
  status text not null check (status in ('draft', 'sent', 'accepted', 'rejected')),
  description text,
  valid_until timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint proposals_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete restrict
);

create index if not exists proposals_org_created_at_idx
on public.proposals (organization_id, created_at desc);

create index if not exists proposals_org_client_idx
on public.proposals (organization_id, client_id);

create index if not exists proposals_org_status_idx
on public.proposals (organization_id, status);

create unique index if not exists proposals_id_org_unique_idx
on public.proposals (id, organization_id);

drop trigger if exists set_proposals_updated_at on public.proposals;
create trigger set_proposals_updated_at
before update on public.proposals
for each row
execute function public.set_updated_at();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bucket_id text not null default 'documents',
  storage_path text not null,
  file_name text not null,
  display_name text not null,
  file_extension text,
  mime_type text,
  size_bytes bigint not null default 0,
  folder text not null default 'Arquivos',
  client_id uuid,
  project_id uuid,
  proposal_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint documents_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete set null,
  constraint documents_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete set null,
  constraint documents_proposal_fk
    foreign key (proposal_id, organization_id)
    references public.proposals (id, organization_id)
    on delete set null
);

create unique index if not exists documents_org_storage_path_unique_idx
on public.documents (organization_id, storage_path)
where deleted_at is null;

create index if not exists documents_org_created_at_idx
on public.documents (organization_id, created_at desc);

create index if not exists documents_org_folder_idx
on public.documents (organization_id, folder);

create index if not exists documents_org_client_idx
on public.documents (organization_id, client_id);

create index if not exists documents_org_project_idx
on public.documents (organization_id, project_id);

create index if not exists documents_org_proposal_idx
on public.documents (organization_id, proposal_id);

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

revoke all on public.proposals from anon;
revoke all on public.documents from anon;

grant select, insert, update on public.proposals to authenticated;
grant select, insert, update on public.documents to authenticated;

alter table public.proposals enable row level security;
alter table public.documents enable row level security;

alter table public.proposals force row level security;
alter table public.documents force row level security;

drop policy if exists "proposals_select_org_members" on public.proposals;
create policy "proposals_select_org_members"
on public.proposals
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "proposals_insert_org_members" on public.proposals;
create policy "proposals_insert_org_members"
on public.proposals
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "proposals_update_org_members" on public.proposals;
create policy "proposals_update_org_members"
on public.proposals
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "proposals_delete_none" on public.proposals;
create policy "proposals_delete_none"
on public.proposals
for delete
to authenticated
using (false);

drop policy if exists "documents_select_org_members" on public.documents;
create policy "documents_select_org_members"
on public.documents
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "documents_insert_org_members" on public.documents;
create policy "documents_insert_org_members"
on public.documents
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "documents_update_org_members" on public.documents;
create policy "documents_update_org_members"
on public.documents
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "documents_delete_none" on public.documents;
create policy "documents_delete_none"
on public.documents
for delete
to authenticated
using (false);

drop policy if exists "documents_bucket_select" on storage.objects;
create policy "documents_bucket_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "documents_bucket_insert" on storage.objects;
create policy "documents_bucket_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "documents_bucket_update" on storage.objects;
create policy "documents_bucket_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "documents_bucket_delete" on storage.objects;
create policy "documents_bucket_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
