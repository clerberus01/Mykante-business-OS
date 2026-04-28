alter table public.project_time_entries
add column if not exists approval_status text not null default 'pending'
  check (approval_status in ('pending', 'approved', 'rejected')),
add column if not exists approved_by uuid references public.profiles(id) on delete set null,
add column if not exists approved_at timestamptz,
add column if not exists rejection_reason text;

create index if not exists project_time_entries_approval_idx
on public.project_time_entries (organization_id, approval_status, started_at desc);

create table if not exists public.project_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  reviewee_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  period_start date not null,
  period_end date not null,
  rating numeric(3,2) not null check (rating >= 1 and rating <= 5),
  delivery_score integer not null default 3 check (delivery_score between 1 and 5),
  quality_score integer not null default 3 check (quality_score between 1 and 5),
  collaboration_score integer not null default 3 check (collaboration_score between 1 and 5),
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_performance_reviews_project_fk
    foreign key (project_id, organization_id)
    references public.projects(id, organization_id)
    on delete cascade,
  constraint project_performance_reviews_period_check
    check (period_end >= period_start)
);

create unique index if not exists project_performance_reviews_unique_idx
on public.project_performance_reviews (organization_id, project_id, reviewee_id, period_start, period_end)
where reviewee_id is not null;

create index if not exists project_performance_reviews_project_idx
on public.project_performance_reviews (organization_id, project_id, created_at desc);

drop trigger if exists set_project_performance_reviews_updated_at on public.project_performance_reviews;
create trigger set_project_performance_reviews_updated_at
before update on public.project_performance_reviews
for each row
execute function public.set_updated_at();

create or replace function public.prevent_project_time_entry_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status is distinct from old.approval_status
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
    or new.rejection_reason is distinct from old.rejection_reason
  then
    if not public.has_org_role(old.organization_id, array['owner', 'admin', 'manager']) then
      raise exception 'Only managers or admins can approve project time entries.';
    end if;
  end if;

  if new.approval_status = 'approved' and new.approved_at is null then
    new.approved_at := timezone('utc', now());
  end if;

  if new.approval_status = 'approved' and new.approved_by is null then
    new.approved_by := auth.uid();
  end if;

  if new.approval_status <> 'approved' then
    new.approved_at := null;
    new.approved_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_project_time_entry_self_approval on public.project_time_entries;
create trigger prevent_project_time_entry_self_approval
before update of approval_status, approved_by, approved_at, rejection_reason on public.project_time_entries
for each row
execute function public.prevent_project_time_entry_self_approval();

create or replace function public.has_org_permission(org_id uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when permission in (
      'organization:read',
      'members:read',
      'crm:manage',
      'projects:manage',
      'finance:manage',
      'documents:manage',
      'calendar:manage',
      'whatsapp:manage',
      'time_entries:read',
      'performance:read'
    ) then public.is_org_member(org_id)
    when permission in (
      'organization:update',
      'members:invite',
      'members:update',
      'notifications:manage',
      'time_entries:approve',
      'performance:manage'
    ) then public.has_org_role(org_id, array['owner', 'admin', 'manager'])
    when permission in (
      'audit:read',
      'lgpd:manage'
    ) then public.has_org_role(org_id, array['owner', 'admin', 'manager'])
    when permission in (
      'organization:delete',
      'members:delete',
      'members:grant_owner'
    ) then public.has_org_role(org_id, array['owner'])
    else false
  end;
$$;

revoke all on function public.prevent_project_time_entry_self_approval() from public;
revoke all on function public.has_org_permission(uuid, text) from public;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

revoke all on public.project_performance_reviews from anon;
grant select, insert, update, delete on public.project_performance_reviews to authenticated;

alter table public.project_performance_reviews enable row level security;
alter table public.project_performance_reviews force row level security;

drop policy if exists "project_performance_reviews_select_org_members" on public.project_performance_reviews;
create policy "project_performance_reviews_select_org_members"
on public.project_performance_reviews
for select
to authenticated
using (public.has_org_permission(organization_id, 'performance:read'));

drop policy if exists "project_performance_reviews_insert_managers" on public.project_performance_reviews;
create policy "project_performance_reviews_insert_managers"
on public.project_performance_reviews
for insert
to authenticated
with check (public.has_org_permission(organization_id, 'performance:manage'));

drop policy if exists "project_performance_reviews_update_managers" on public.project_performance_reviews;
create policy "project_performance_reviews_update_managers"
on public.project_performance_reviews
for update
to authenticated
using (public.has_org_permission(organization_id, 'performance:manage'))
with check (public.has_org_permission(organization_id, 'performance:manage'));

drop policy if exists "project_performance_reviews_delete_admins" on public.project_performance_reviews;
create policy "project_performance_reviews_delete_admins"
on public.project_performance_reviews
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));
