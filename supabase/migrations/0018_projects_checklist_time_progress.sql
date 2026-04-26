alter table public.tasks
add column if not exists responsible_id uuid references public.profiles(id) on delete set null;

update public.tasks
set responsible_id = created_by
where responsible_id is null
  and created_by is not null;

create index if not exists tasks_org_responsible_idx
on public.tasks (organization_id, responsible_id)
where responsible_id is not null;

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid not null,
  text text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_checklist_items_task_fk
    foreign key (task_id, organization_id)
    references public.tasks (id, organization_id)
    on delete cascade,
  constraint task_checklist_items_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete cascade
);

create index if not exists task_checklist_items_task_order_idx
on public.task_checklist_items (task_id, sort_order asc, created_at asc);

insert into public.task_checklist_items (
  id,
  organization_id,
  project_id,
  task_id,
  text,
  completed,
  sort_order,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  t.organization_id,
  t.project_id,
  t.id,
  coalesce(nullif(item.value ->> 'text', ''), 'Item'),
  coalesce((item.value ->> 'completed')::boolean, false),
  item.ordinality::integer - 1,
  t.created_at,
  t.updated_at
from public.tasks t
cross join lateral jsonb_array_elements(coalesce(t.checklist, '[]'::jsonb)) with ordinality as item(value, ordinality)
where not exists (
  select 1
  from public.task_checklist_items existing
  where existing.task_id = t.id
);

drop trigger if exists set_task_checklist_items_updated_at on public.task_checklist_items;
create trigger set_task_checklist_items_updated_at
before update on public.task_checklist_items
for each row
execute function public.set_updated_at();

create table if not exists public.project_time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  task_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  stopped_at timestamptz,
  duration_minutes integer generated always as (
    case
      when stopped_at is null then null
      else greatest(0, ceil(extract(epoch from (stopped_at - started_at)) / 60.0)::integer)
    end
  ) stored,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint project_time_entries_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete cascade,
  constraint project_time_entries_task_fk
    foreign key (task_id, organization_id)
    references public.tasks (id, organization_id)
    on delete set null,
  constraint project_time_entries_time_order
    check (stopped_at is null or stopped_at >= started_at)
);

create index if not exists project_time_entries_project_started_idx
on public.project_time_entries (project_id, started_at desc);

create index if not exists project_time_entries_task_idx
on public.project_time_entries (task_id, started_at desc)
where task_id is not null;

create unique index if not exists project_time_entries_one_active_per_user_idx
on public.project_time_entries (organization_id, user_id)
where stopped_at is null and user_id is not null;

alter table public.project_time_entries
drop constraint if exists project_time_entries_task_fk;

alter table public.project_time_entries
add constraint project_time_entries_task_fk
  foreign key (task_id, organization_id)
  references public.tasks (id, organization_id)
  on delete cascade;

revoke all on public.task_checklist_items from anon;
revoke all on public.project_time_entries from anon;

grant select, insert, update, delete on public.task_checklist_items to authenticated;
grant select, insert, update on public.project_time_entries to authenticated;

alter table public.task_checklist_items enable row level security;
alter table public.project_time_entries enable row level security;

alter table public.task_checklist_items force row level security;
alter table public.project_time_entries force row level security;

drop policy if exists "task_checklist_items_select_org_members" on public.task_checklist_items;
create policy "task_checklist_items_select_org_members"
on public.task_checklist_items
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "task_checklist_items_insert_org_members" on public.task_checklist_items;
create policy "task_checklist_items_insert_org_members"
on public.task_checklist_items
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.project_id = task_checklist_items.project_id
      and t.organization_id = task_checklist_items.organization_id
  )
);

drop policy if exists "task_checklist_items_update_org_members" on public.task_checklist_items;
create policy "task_checklist_items_update_org_members"
on public.task_checklist_items
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1
    from public.tasks t
    where t.id = task_id
      and t.project_id = task_checklist_items.project_id
      and t.organization_id = task_checklist_items.organization_id
  )
);

drop policy if exists "task_checklist_items_delete_org_members" on public.task_checklist_items;
create policy "task_checklist_items_delete_org_members"
on public.task_checklist_items
for delete
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "project_time_entries_select_org_members" on public.project_time_entries;
create policy "project_time_entries_select_org_members"
on public.project_time_entries
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "project_time_entries_insert_self" on public.project_time_entries;
create policy "project_time_entries_insert_self"
on public.project_time_entries
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and user_id = auth.uid()
);

drop policy if exists "project_time_entries_update_self_or_admin" on public.project_time_entries;
create policy "project_time_entries_update_self_or_admin"
on public.project_time_entries
for update
to authenticated
using (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    user_id = auth.uid()
    or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
  )
);

drop policy if exists "tasks_insert_org_members" on public.tasks;
create policy "tasks_insert_org_members"
on public.tasks
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    responsible_id is null
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = tasks.organization_id
        and om.user_id = tasks.responsible_id
        and om.status = 'active'
    )
  )
);

drop policy if exists "tasks_update_org_members" on public.tasks;
create policy "tasks_update_org_members"
on public.tasks
for update
to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and (
    responsible_id is null
    or exists (
      select 1
      from public.organization_members om
      where om.organization_id = tasks.organization_id
        and om.user_id = tasks.responsible_id
        and om.status = 'active'
    )
  )
);

create or replace function public.recalculate_project_progress(target_project_id uuid, target_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total_tasks integer;
  done_tasks integer;
  total_milestones integer;
  done_milestones integer;
  next_progress integer;
begin
  select count(*), count(*) filter (where status = 'done')
  into total_tasks, done_tasks
  from public.tasks
  where project_id = target_project_id
    and organization_id = target_organization_id;

  if total_tasks > 0 then
    next_progress := round((done_tasks::numeric / total_tasks::numeric) * 100)::integer;
  else
    select count(*), count(*) filter (where status = 'completed')
    into total_milestones, done_milestones
    from public.milestones
    where project_id = target_project_id
      and organization_id = target_organization_id;

    next_progress := case
      when total_milestones > 0 then round((done_milestones::numeric / total_milestones::numeric) * 100)::integer
      else 0
    end;
  end if;

  update public.projects
  set
    progress = next_progress,
    status = case
      when next_progress = 100 and status not in ('cancelled', 'completed') then 'completed'
      when next_progress < 100 and status = 'completed' then 'ongoing'
      else status
    end
  where id = target_project_id
    and organization_id = target_organization_id;

  return next_progress;
end;
$$;

create or replace function public.notify_project_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_task public.tasks%rowtype;
  project_name text;
  next_progress integer;
begin
  target_task := coalesce(new, old);

  select name
  into project_name
  from public.projects
  where id = target_task.project_id
    and organization_id = target_task.organization_id;

  next_progress := public.recalculate_project_progress(target_task.project_id, target_task.organization_id);

  if tg_op = 'INSERT' and new.responsible_id is not null then
    insert into public.notification_dispatches (
      organization_id,
      user_id,
      channel,
      provider,
      template_key,
      payload
    )
    values (
      new.organization_id,
      new.responsible_id,
      'push',
      'onesignal',
      'project_task_assigned',
      jsonb_build_object('projectId', new.project_id, 'taskId', new.id, 'projectName', project_name, 'taskTitle', new.title)
    );
  end if;

  if tg_op = 'UPDATE'
    and new.responsible_id is not null
    and new.responsible_id is distinct from old.responsible_id then
    insert into public.notification_dispatches (
      organization_id,
      user_id,
      channel,
      provider,
      template_key,
      payload
    )
    values (
      new.organization_id,
      new.responsible_id,
      'push',
      'onesignal',
      'project_task_assigned',
      jsonb_build_object('projectId', new.project_id, 'taskId', new.id, 'projectName', project_name, 'taskTitle', new.title)
    );
  end if;

  if tg_op = 'UPDATE'
    and new.status = 'done'
    and old.status is distinct from new.status
    and new.responsible_id is not null then
    insert into public.notification_dispatches (
      organization_id,
      user_id,
      channel,
      provider,
      template_key,
      payload
    )
    values (
      new.organization_id,
      new.responsible_id,
      'push',
      'onesignal',
      'project_task_completed',
      jsonb_build_object('projectId', new.project_id, 'taskId', new.id, 'projectName', project_name, 'taskTitle', new.title)
    );
  end if;

  if next_progress = 100 then
    insert into public.notification_dispatches (
      organization_id,
      user_id,
      channel,
      provider,
      template_key,
      payload
    )
    select
      target_task.organization_id,
      om.user_id,
      'push',
      'onesignal',
      'project_completed',
      jsonb_build_object('projectId', target_task.project_id, 'projectName', project_name)
    from public.organization_members om
    where om.organization_id = target_task.organization_id
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager')
      and not exists (
        select 1
        from public.notification_dispatches existing
        where existing.organization_id = target_task.organization_id
          and existing.user_id = om.user_id
          and existing.template_key = 'project_completed'
          and existing.payload ->> 'projectId' = target_task.project_id::text
      );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists notify_project_task_change on public.tasks;
create trigger notify_project_task_change
after insert or update or delete on public.tasks
for each row
execute function public.notify_project_task_change();

create or replace function public.recalculate_project_progress_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_project_progress(coalesce(new.project_id, old.project_id), coalesce(new.organization_id, old.organization_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists recalculate_project_progress_from_milestone on public.milestones;
create trigger recalculate_project_progress_from_milestone
after insert or update or delete on public.milestones
for each row
execute function public.recalculate_project_progress_from_milestone();
