-- Ensure every application table in the public schema is protected by RLS.
-- This is intentionally idempotent and does not change any policy condition.
do $$
declare
  target_table record;
begin
  for target_table in
    select c.oid::regclass as table_identifier
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format('alter table %s enable row level security', target_table.table_identifier);
    execute format('alter table %s force row level security', target_table.table_identifier);
  end loop;
end $$;
