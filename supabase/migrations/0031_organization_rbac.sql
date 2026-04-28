-- Central RBAC helpers for organization-scoped authorization.
-- Keeps existing business access unchanged while making role checks reusable.

create or replace function public.current_org_role(org_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

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
      'whatsapp:manage'
    ) then public.is_org_member(org_id)
    when permission in (
      'organization:update',
      'members:invite',
      'members:update',
      'notifications:manage'
    ) then public.has_org_role(org_id, array['owner', 'admin'])
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

create or replace function public.prevent_last_org_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_other_owner boolean;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'active' then
      select exists (
        select 1
        from public.organization_members om
        where om.organization_id = old.organization_id
          and om.id <> old.id
          and om.role = 'owner'
          and om.status = 'active'
      )
      into has_other_owner;

      if not has_other_owner then
        raise exception 'Cannot remove the last active owner from an organization.';
      end if;
    end if;

    return old;
  end if;

  if old.role = 'owner'
    and old.status = 'active'
    and (
      new.role <> 'owner'
      or new.status <> 'active'
      or new.organization_id <> old.organization_id
      or new.user_id <> old.user_id
    )
  then
    select exists (
      select 1
      from public.organization_members om
      where om.organization_id = old.organization_id
        and om.id <> old.id
        and om.role = 'owner'
        and om.status = 'active'
    )
    into has_other_owner;

    if not has_other_owner then
      raise exception 'Cannot remove the last active owner from an organization.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_org_owner_loss on public.organization_members;
create trigger prevent_last_org_owner_loss
before update or delete on public.organization_members
for each row
execute function public.prevent_last_org_owner_loss();

drop policy if exists "organization_members_insert_owner_or_admin" on public.organization_members;
create policy "organization_members_insert_owner_or_admin"
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_permission(organization_id, 'members:invite')
  and (
    role <> 'owner'
    or public.has_org_permission(organization_id, 'members:grant_owner')
  )
);

drop policy if exists "organization_members_update_owner_or_admin" on public.organization_members;
create policy "organization_members_update_owner_or_admin"
on public.organization_members
for update
to authenticated
using (public.has_org_permission(organization_id, 'members:update'))
with check (
  public.has_org_permission(organization_id, 'members:update')
  and (
    role <> 'owner'
    or public.has_org_permission(organization_id, 'members:grant_owner')
  )
);

drop policy if exists "organization_members_delete_owner_only" on public.organization_members;
create policy "organization_members_delete_owner_only"
on public.organization_members
for delete
to authenticated
using (
  public.has_org_permission(organization_id, 'members:delete')
  and role <> 'owner'
);

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (public.has_org_permission(id, 'organization:update'))
with check (public.has_org_permission(id, 'organization:update'));

drop policy if exists "organizations_delete_owner" on public.organizations;
create policy "organizations_delete_owner"
on public.organizations
for delete
to authenticated
using (public.has_org_permission(id, 'organization:delete'));

revoke all on function public.current_org_role(uuid) from public;
revoke all on function public.has_org_permission(uuid, text) from public;
grant execute on function public.current_org_role(uuid) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
