alter table public.documents
add column if not exists signature_status text not null default 'not_requested'
  check (signature_status in ('not_requested', 'requested', 'signed', 'declined', 'expired')),
add column if not exists signature_provider text,
add column if not exists signature_request_id text,
add column if not exists signature_url text,
add column if not exists signature_requested_at timestamptz,
add column if not exists signature_completed_at timestamptz,
add column if not exists ocr_status text not null default 'not_requested'
  check (ocr_status in ('not_requested', 'queued', 'processing', 'completed', 'failed', 'provider_required')),
add column if not exists ocr_text text,
add column if not exists ocr_data jsonb not null default '{}'::jsonb,
add column if not exists ocr_processed_at timestamptz,
add column if not exists current_version integer not null default 1;

create index if not exists documents_signature_status_idx
on public.documents (organization_id, signature_status, updated_at desc);

create index if not exists documents_ocr_status_idx
on public.documents (organization_id, ocr_status, updated_at desc);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null,
  bucket_id text not null default 'documents',
  storage_path text not null,
  file_name text not null,
  file_extension text,
  mime_type text,
  size_bytes bigint not null default 0,
  checksum text,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, document_id, version_number)
);

create index if not exists document_versions_document_idx
on public.document_versions (organization_id, document_id, version_number desc);

create table if not exists public.document_signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null default 'internal_pdf',
  signer_email text not null,
  signer_name text,
  status text not null default 'requested'
    check (status in ('requested', 'signed', 'declined', 'expired')),
  public_token text not null default encode(gen_random_bytes(24), 'hex'),
  signing_url text,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (public_token)
);

create index if not exists document_signature_requests_document_idx
on public.document_signature_requests (organization_id, document_id, requested_at desc);

insert into public.document_versions (
  organization_id,
  document_id,
  version_number,
  bucket_id,
  storage_path,
  file_name,
  file_extension,
  mime_type,
  size_bytes,
  created_by,
  created_at
)
select
  d.organization_id,
  d.id,
  1,
  d.bucket_id,
  d.storage_path,
  d.file_name,
  d.file_extension,
  d.mime_type,
  d.size_bytes,
  d.created_by,
  d.created_at
from public.documents d
where not exists (
  select 1
  from public.document_versions dv
  where dv.organization_id = d.organization_id
    and dv.document_id = d.id
    and dv.version_number = 1
);

create or replace function public.sync_document_signature_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.documents
  set
    signature_status = new.status,
    signature_provider = new.provider,
    signature_request_id = new.id::text,
    signature_url = new.signing_url,
    signature_requested_at = new.requested_at,
    signature_completed_at = new.completed_at
  where id = new.document_id
    and organization_id = new.organization_id;

  return new;
end;
$$;

drop trigger if exists sync_document_signature_request on public.document_signature_requests;
create trigger sync_document_signature_request
after insert or update on public.document_signature_requests
for each row
execute function public.sync_document_signature_request();

revoke all on public.document_versions from anon;
revoke all on public.document_signature_requests from anon;
grant select, insert, update on public.document_versions to authenticated;
grant select, insert, update on public.document_signature_requests to authenticated;

alter table public.document_versions enable row level security;
alter table public.document_versions force row level security;
alter table public.document_signature_requests enable row level security;
alter table public.document_signature_requests force row level security;

drop policy if exists "document_versions_select_org_members" on public.document_versions;
create policy "document_versions_select_org_members"
on public.document_versions
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "document_versions_insert_org_members" on public.document_versions;
create policy "document_versions_insert_org_members"
on public.document_versions
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "document_versions_update_admins" on public.document_versions;
create policy "document_versions_update_admins"
on public.document_versions
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "document_signature_requests_select_org_members" on public.document_signature_requests;
create policy "document_signature_requests_select_org_members"
on public.document_signature_requests
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "document_signature_requests_insert_managers" on public.document_signature_requests;
create policy "document_signature_requests_insert_managers"
on public.document_signature_requests
for insert
to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "document_signature_requests_update_managers" on public.document_signature_requests;
create policy "document_signature_requests_update_managers"
on public.document_signature_requests
for update
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));
