-- Harden automatic audit logging and attach it to all current public tables.
-- The trigger is intentionally AFTER-row so it observes committed row values
-- without changing application writes.

create or replace function public.audit_redact_row(row_value jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_object_agg(
      key,
      case
        when key ~* '(password|passcode|secret|token|api[_-]?key|service[_-]?role|private[_-]?key|signature|authorization|otp|mfa|factor|refresh[_-]?token|access[_-]?token)'
          then '"[REDACTED]"'::jsonb
        else value
      end
    ),
    '{}'::jsonb
  )
  from jsonb_each(coalesce(row_value, '{}'::jsonb));
$$;

create or replace function public.audit_changed_columns(old_row jsonb, new_row jsonb)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(key order by key), array[]::text[])
  from (
    select key
    from jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) as keys(key)
    where coalesce(old_row, '{}'::jsonb) -> key is distinct from coalesce(new_row, '{}'::jsonb) -> key
      and key not in ('updated_at')
  ) changed;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  row_data jsonb := case when tg_op = 'DELETE' then old_row else new_row end;
  redacted_old_row jsonb := public.audit_redact_row(old_row);
  redacted_new_row jsonb := public.audit_redact_row(new_row);
  audit_organization_id uuid;
  audit_target_id uuid;
  current_actor_id uuid := auth.uid();
  audit_actor_user_id uuid;
  changed_columns text[] := array[]::text[];
  redacted_columns text[];
begin
  if tg_table_schema <> 'public' or tg_table_name = 'audit_logs' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    changed_columns := public.audit_changed_columns(old_row, new_row);

    if cardinality(changed_columns) = 0 then
      return coalesce(new, old);
    end if;
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

  select current_actor_id
  into audit_actor_user_id
  where current_actor_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = current_actor_id
    );

  select coalesce(array_agg(key order by key), array[]::text[])
  into redacted_columns
  from jsonb_object_keys(row_data) as keys(key)
  where key ~* '(password|passcode|secret|token|api[_-]?key|service[_-]?role|private[_-]?key|signature|authorization|otp|mfa|factor|refresh[_-]?token|access[_-]?token)';

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
      'redacted_columns', redacted_columns,
      'old', case when tg_op in ('UPDATE', 'DELETE') then redacted_old_row else null end,
      'new', case when tg_op in ('INSERT', 'UPDATE') then redacted_new_row else null end
    )
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.attach_audit_triggers()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_table record;
begin
  for target_table in
    select c.oid::regclass as table_identifier, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> 'audit_logs'
      and c.relname not like 'pg_%'
      and c.relname not like 'schema_%'
  loop
    execute format(
      'drop trigger if exists audit_%I_row_change on %s',
      target_table.table_name,
      target_table.table_identifier
    );
    execute format(
      'create trigger audit_%I_row_change after insert or update or delete on %s for each row execute function public.audit_row_change()',
      target_table.table_name,
      target_table.table_identifier
    );
  end loop;
end;
$$;

select public.attach_audit_triggers();

create index if not exists audit_logs_target_idx
on public.audit_logs (target_table, target_id, created_at desc);

create index if not exists audit_logs_action_idx
on public.audit_logs (action, created_at desc);
