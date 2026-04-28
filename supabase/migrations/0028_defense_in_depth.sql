create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed after creation'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_core_business_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'clients' then
    if nullif(trim(new.name), '') is null then
      raise exception 'client name is required' using errcode = '23514';
    end if;

    if nullif(trim(new.email), '') is null or position('@' in new.email) <= 1 then
      raise exception 'client email is invalid' using errcode = '23514';
    end if;
  elsif tg_table_name = 'proposals' then
    if nullif(trim(new.title), '') is null then
      raise exception 'proposal title is required' using errcode = '23514';
    end if;

    if new.value < 0 then
      raise exception 'proposal value cannot be negative' using errcode = '23514';
    end if;
  elsif tg_table_name = 'transactions' then
    if nullif(trim(new.description), '') is null then
      raise exception 'transaction description is required' using errcode = '23514';
    end if;

    if new.amount < 0 then
      raise exception 'transaction amount cannot be negative' using errcode = '23514';
    end if;
  elsif tg_table_name = 'calendar_events' then
    if nullif(trim(new.title), '') is null then
      raise exception 'calendar event title is required' using errcode = '23514';
    end if;

    if new.ends_at <= new.starts_at then
      raise exception 'calendar event end must be after start' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  scoped_table text;
begin
  foreach scoped_table in array array[
    'organizations',
    'organization_members',
    'audit_logs',
    'consents',
    'notification_preferences',
    'notification_subscriptions',
    'notification_dispatches',
    'clients',
    'client_events',
    'projects',
    'milestones',
    'tasks',
    'project_activity',
    'task_checklist_items',
    'project_time_entries',
    'project_templates',
    'project_template_milestones',
    'project_template_tasks',
    'transactions',
    'finance_categories',
    'cost_centers',
    'bank_statement_imports',
    'bank_statement_lines',
    'payment_requests',
    'proposals',
    'documents',
    'whatsapp_conversations',
    'whatsapp_messages',
    'crm_pipeline_stages',
    'crm_deals',
    'data_retention_policies',
    'data_subject_requests',
    'calendar_events',
    'calendar_event_attendees',
    'calendar_booking_links',
    'calendar_external_sync_accounts'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = scoped_table
        and column_name = 'organization_id'
    ) then
      execute format('drop trigger if exists prevent_%I_organization_id_change on public.%I', scoped_table, scoped_table);
      execute format(
        'create trigger prevent_%I_organization_id_change before update on public.%I for each row execute function public.prevent_organization_id_change()',
        scoped_table,
        scoped_table
      );
    end if;
  end loop;
end $$;

drop trigger if exists validate_clients_core_business_record on public.clients;
create trigger validate_clients_core_business_record
before insert or update on public.clients
for each row execute function public.validate_core_business_record();

drop trigger if exists validate_proposals_core_business_record on public.proposals;
create trigger validate_proposals_core_business_record
before insert or update on public.proposals
for each row execute function public.validate_core_business_record();

drop trigger if exists validate_transactions_core_business_record on public.transactions;
create trigger validate_transactions_core_business_record
before insert or update on public.transactions
for each row execute function public.validate_core_business_record();

drop trigger if exists validate_calendar_events_core_business_record on public.calendar_events;
create trigger validate_calendar_events_core_business_record
before insert or update on public.calendar_events
for each row execute function public.validate_core_business_record();

alter table public.clients
  drop constraint if exists clients_email_defense_check,
  add constraint clients_email_defense_check
    check (char_length(trim(email)) between 3 and 320 and position('@' in email) > 1)
    not valid;

alter table public.proposals
  drop constraint if exists proposals_value_defense_check,
  add constraint proposals_value_defense_check
    check (value >= 0)
    not valid;

alter table public.documents
  drop constraint if exists documents_size_defense_check,
  add constraint documents_size_defense_check
    check (size_bytes >= 0)
    not valid;

alter table public.calendar_booking_links
  drop constraint if exists calendar_booking_links_duration_defense_check,
  add constraint calendar_booking_links_duration_defense_check
    check (duration_minutes between 15 and 480)
    not valid;

drop policy if exists "calendar_attendees_delete_org_members" on public.calendar_event_attendees;
create policy "calendar_attendees_delete_org_members"
on public.calendar_event_attendees
for delete
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "calendar_booking_links_update_org_members" on public.calendar_booking_links;
create policy "calendar_booking_links_update_org_members"
on public.calendar_booking_links
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "calendar_external_sync_update_org_members" on public.calendar_external_sync_accounts;
create policy "calendar_external_sync_update_org_members"
on public.calendar_external_sync_accounts
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));
