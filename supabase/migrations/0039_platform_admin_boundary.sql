-- Platform administrators are separate from organization owners/admins.
-- Organization roles never grant platform-level access.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin', 'support_admin', 'billing_admin')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  unique (user_id)
);

create index if not exists platform_admins_active_user_idx
on public.platform_admins (user_id)
where status = 'active';

revoke all on public.platform_admins from anon;
revoke all on public.platform_admins from authenticated;
grant select on public.platform_admins to authenticated;

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_mfa_verified()
    and exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = auth.uid()
        and pa.status = 'active'
    );
$$;

create or replace function public.can_claim_initial_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_mfa_verified()
    and auth.uid() is not null
    and not exists (
      select 1
      from public.platform_admins pa
      where pa.status = 'active'
    );
$$;

create or replace function public.claim_initial_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_mfa_verified() then
    raise exception 'MFA verification required';
  end if;

  if exists (
    select 1
    from public.platform_admins pa
    where pa.status = 'active'
  ) then
    raise exception 'Initial platform administrator already exists.';
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

  insert into public.platform_admins (user_id, role, status, created_by)
  values (current_user_id, 'super_admin', 'active', current_user_id)
  on conflict (user_id) do update
  set
    role = 'super_admin',
    status = 'active',
    revoked_at = null,
    revoked_by = null;

  return true;
end;
$$;

drop policy if exists "platform_admins_select_platform_admins" on public.platform_admins;
create policy "platform_admins_select_platform_admins"
on public.platform_admins
for select
to authenticated
using (public.is_platform_admin());

revoke all on function public.is_platform_admin() from public;
revoke all on function public.can_claim_initial_platform_admin() from public;
revoke all on function public.claim_initial_platform_admin() from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.can_claim_initial_platform_admin() to authenticated;
grant execute on function public.claim_initial_platform_admin() to authenticated;
