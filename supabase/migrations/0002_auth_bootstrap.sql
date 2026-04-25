create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, 'workspace')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.bootstrap_current_user_organization(
  org_name text default null,
  org_slug text default null
)
returns table (
  organization_id uuid,
  membership_id uuid,
  role public.app_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_org_id uuid;
  existing_membership_id uuid;
  profile_name text;
  target_name text;
  target_slug text;
  target_org_id uuid;
  target_membership_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.raw_user_meta_data ->> 'avatar_url'
  from auth.users u
  where u.id = current_user_id
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now());

  select om.organization_id, om.id, om.role
  into existing_org_id, existing_membership_id, role
  from public.organization_members om
  where om.user_id = current_user_id
    and om.status = 'active'
  order by om.created_at asc
  limit 1;

  if existing_org_id is not null then
    organization_id := existing_org_id;
    membership_id := existing_membership_id;
    return next;
    return;
  end if;

  select p.full_name
  into profile_name
  from public.profiles p
  where p.id = current_user_id;

  target_name := coalesce(nullif(trim(org_name), ''), nullif(trim(profile_name), ''), 'Mykante Workspace');
  target_name := target_name || ' Workspace';

  target_slug := coalesce(nullif(trim(org_slug), ''), public.slugify(target_name));

  if target_slug = '' then
    target_slug := 'workspace';
  end if;

  if exists (select 1 from public.organizations o where o.slug = target_slug and o.deleted_at is null) then
    target_slug := target_slug || '-' || substring(replace(current_user_id::text, '-', ''), 1, 8);
  end if;

  insert into public.organizations (
    name,
    slug,
    created_by
  )
  values (
    target_name,
    target_slug,
    current_user_id
  )
  returning id into target_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    target_org_id,
    current_user_id,
    'owner',
    'active',
    current_user_id,
    timezone('utc', now())
  )
  returning id into target_membership_id;

  organization_id := target_org_id;
  membership_id := target_membership_id;
  role := 'owner';

  return next;
end;
$$;

grant execute on function public.bootstrap_current_user_organization(text, text) to authenticated;
