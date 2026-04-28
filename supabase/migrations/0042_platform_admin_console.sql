-- Platform admin console data lives behind SECURITY DEFINER RPCs.
-- Organization owner/admin roles remain scoped to their own organization.

create or replace function public.get_platform_admin_console()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required.';
  end if;

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'organizations', (select count(*) from public.organizations),
      'activeMembers', (select count(*) from public.organization_members where status = 'active'),
      'profiles', (select count(*) from public.profiles),
      'platformAdmins', (select count(*) from public.platform_admins where status = 'active'),
      'events24h', (
        select count(*)
        from public.domain_events
        where occurred_at >= timezone('utc', now()) - interval '24 hours'
      ),
      'pendingWebhooks', (
        select count(*)
        from public.event_webhook_deliveries
        where status in ('pending', 'failed')
      )
    ),
    'organizations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', organization_row.id,
          'name', organization_row.name,
          'slug', organization_row.slug,
          'createdAt', organization_row.created_at,
          'memberCount', organization_row.member_count,
          'activeMemberCount', organization_row.active_member_count
        )
        order by organization_row.created_at desc
      )
      from (
        select
          o.id,
          o.name,
          o.slug,
          o.created_at,
          count(om.id) as member_count,
          count(om.id) filter (where om.status = 'active') as active_member_count
        from public.organizations o
        left join public.organization_members om on om.organization_id = o.id
        group by o.id
        order by o.created_at desc
        limit 20
      ) organization_row
    ), '[]'::jsonb),
    'platformAdmins', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pa.id,
          'userId', pa.user_id,
          'email', p.email,
          'fullName', p.full_name,
          'role', pa.role,
          'status', pa.status,
          'createdAt', pa.created_at,
          'revokedAt', pa.revoked_at
        )
        order by pa.created_at desc
      )
      from public.platform_admins pa
      left join public.profiles p on p.id = pa.user_id
    ), '[]'::jsonb),
    'recentEvents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', de.id,
          'organizationId', de.organization_id,
          'eventType', de.event_type,
          'sourceTable', de.source_table,
          'sourceOperation', de.source_operation,
          'aggregateId', de.aggregate_id,
          'occurredAt', de.occurred_at
        )
        order by de.occurred_at desc
      )
      from (
        select *
        from public.domain_events
        order by occurred_at desc
        limit 30
      ) de
    ), '[]'::jsonb),
    'webhookDeliveries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', delivery_row.id,
          'organizationId', delivery_row.organization_id,
          'eventId', delivery_row.event_id,
          'endpointId', delivery_row.endpoint_id,
          'status', delivery_row.status,
          'attempts', delivery_row.attempts,
          'nextAttemptAt', delivery_row.next_attempt_at,
          'responseStatus', delivery_row.response_status,
          'updatedAt', delivery_row.updated_at
        )
        order by delivery_row.updated_at desc
      )
      from (
        select *
        from public.event_webhook_deliveries
        order by updated_at desc
        limit 30
      ) delivery_row
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.revoke_current_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  other_active_admins integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required.';
  end if;

  select count(*)
  into other_active_admins
  from public.platform_admins pa
  where pa.status = 'active'
    and pa.user_id <> current_user_id;

  if other_active_admins = 0 then
    raise exception 'Cannot revoke the last active platform administrator.';
  end if;

  update public.platform_admins
  set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    revoked_by = current_user_id
  where user_id = current_user_id
    and status = 'active';

  return true;
end;
$$;

revoke all on function public.get_platform_admin_console() from public;
revoke all on function public.revoke_current_platform_admin() from public;

grant execute on function public.get_platform_admin_console() to authenticated;
grant execute on function public.revoke_current_platform_admin() to authenticated;
