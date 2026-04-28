create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  row_data jsonb := case when tg_op = 'DELETE' then old_row else new_row end;
  audit_organization_id uuid;
  audit_target_id uuid;
  audit_actor_user_id uuid := auth.uid();
  changed_columns text[];
begin
  if tg_table_schema <> 'public' or tg_table_name = 'audit_logs' then
    return coalesce(new, old);
  end if;

  if row_data ? 'organization_id' and nullif(row_data ->> 'organization_id', '') is not null then
    audit_organization_id := (row_data ->> 'organization_id')::uuid;
  elsif tg_table_name = 'organizations' and row_data ? 'id' then
    audit_organization_id := (row_data ->> 'id')::uuid;
  else
    audit_organization_id := null;
  end if;

  if row_data ? 'id'
    and nullif(row_data ->> 'id', '') is not null
    and (row_data ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    audit_target_id := (row_data ->> 'id')::uuid;
  else
    audit_target_id := null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), array[]::text[])
    into changed_columns
    from (
      select key
      from jsonb_object_keys(old_row || new_row) as keys(key)
      where old_row -> key is distinct from new_row -> key
        and key not in ('updated_at')
    ) changed;
  else
    changed_columns := array[]::text[];
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    audit_organization_id,
    audit_actor_user_id,
    lower(tg_op),
    tg_table_name,
    audit_target_id,
    jsonb_build_object(
      'schema', tg_table_schema,
      'operation', tg_op,
      'changed_columns', changed_columns,
      'old', case when tg_op in ('UPDATE', 'DELETE') then old_row else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then new_row else null end
    )
  );

  return coalesce(new, old);
end;
$$;

do $$
declare
  audited_table text;
begin
  foreach audited_table in array array[
    'organizations',
    'organization_members',
    'profiles',
    'clients',
    'client_events',
    'crm_pipeline_stages',
    'crm_deals',
    'proposals',
    'projects',
    'milestones',
    'tasks',
    'task_checklist_items',
    'project_time_entries',
    'project_activity',
    'transactions',
    'finance_categories',
    'cost_centers',
    'payment_requests',
    'documents',
    'calendar_events',
    'calendar_event_attendees',
    'calendar_booking_links',
    'calendar_external_sync_accounts',
    'whatsapp_conversations',
    'whatsapp_messages',
    'notification_preferences',
    'notification_subscriptions',
    'notification_dispatches',
    'consents',
    'data_subject_requests'
  ]
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = audited_table
    ) then
      execute format('drop trigger if exists audit_%I_row_change on public.%I', audited_table, audited_table);
      execute format(
        'create trigger audit_%I_row_change after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
        audited_table,
        audited_table
      );
    end if;
  end loop;
end $$;

create index if not exists audit_logs_target_idx
on public.audit_logs (target_table, target_id, created_at desc);

create index if not exists audit_logs_action_idx
on public.audit_logs (action, created_at desc);
