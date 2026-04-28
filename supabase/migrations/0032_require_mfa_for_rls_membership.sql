-- Require a verified MFA session (AAL2) for organization-scoped RLS helpers.
-- Public token/link APIs continue to use server-side service-role validation.

create or replace function public.is_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_mfa_verified()
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_mfa_verified()
    and exists (
      select 1
      from public.organization_members om
      where om.organization_id = org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role::text = any (allowed_roles)
    );
$$;

revoke all on function public.is_mfa_verified() from public;
grant execute on function public.is_mfa_verified() to authenticated;
