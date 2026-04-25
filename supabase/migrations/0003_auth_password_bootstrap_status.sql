create or replace function public.get_auth_bootstrap_status()
returns table (
  can_create_initial_admin boolean,
  organizations_count bigint,
  active_memberships_count bigint
)
language sql
security definer
set search_path = public
as $$
  with orgs as (
    select count(*)::bigint as total
    from public.organizations
    where deleted_at is null
  ),
  members as (
    select count(*)::bigint as total
    from public.organization_members
    where status = 'active'
  )
  select
    (members.total = 0) as can_create_initial_admin,
    orgs.total as organizations_count,
    members.total as active_memberships_count
  from orgs, members;
$$;

grant execute on function public.get_auth_bootstrap_status() to anon, authenticated;
