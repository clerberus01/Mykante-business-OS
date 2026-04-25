create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  name text not null,
  description text,
  status text not null check (status in ('draft', 'ongoing', 'paused', 'completed', 'cancelled')),
  start_date timestamptz not null,
  deadline timestamptz not null,
  budget numeric(12,2) not null default 0,
  payment_status text not null check (payment_status in ('paid', 'pending', 'overdue')),
  progress integer not null default 0 check (progress between 0 and 100),
  financial_balance numeric(12,2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint projects_client_fk
    foreign key (client_id, organization_id)
    references public.clients (id, organization_id)
    on delete restrict
);

create index if not exists projects_org_created_at_idx
on public.projects (organization_id, created_at desc);

create index if not exists projects_org_client_idx
on public.projects (organization_id, client_id);

create index if not exists projects_org_status_idx
on public.projects (organization_id, status);

create unique index if not exists projects_id_org_unique_idx
on public.projects (id, organization_id);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  title text not null,
  sort_order integer not null default 0,
  status text not null check (status in ('pending', 'completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint milestones_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete cascade
);

create index if not exists milestones_project_order_idx
on public.milestones (project_id, sort_order asc);

create unique index if not exists milestones_id_org_unique_idx
on public.milestones (id, organization_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  milestone_id uuid not null,
  title text not null,
  description text,
  status text not null check (status in ('todo', 'doing', 'done')),
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  responsible text not null,
  checklist jsonb not null default '[]'::jsonb,
  due_date timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete cascade,
  constraint tasks_milestone_fk
    foreign key (milestone_id, organization_id)
    references public.milestones (id, organization_id)
    on delete cascade
);

create index if not exists tasks_project_created_at_idx
on public.tasks (project_id, created_at asc);

create index if not exists tasks_project_status_idx
on public.tasks (project_id, status);

create unique index if not exists tasks_id_org_unique_idx
on public.tasks (id, organization_id);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  user_id text not null,
  user_name text not null,
  action text not null,
  details text not null,
  timestamp timestamptz not null default timezone('utc', now()),
  constraint project_activity_project_fk
    foreign key (project_id, organization_id)
    references public.projects (id, organization_id)
    on delete cascade
);

create index if not exists project_activity_project_timestamp_idx
on public.project_activity (project_id, timestamp desc);

revoke all on public.projects from anon;
revoke all on public.milestones from anon;
revoke all on public.tasks from anon;
revoke all on public.project_activity from anon;

grant select, insert, update on public.projects to authenticated;
grant select, insert, update on public.milestones to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert on public.project_activity to authenticated;

alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.project_activity enable row level security;

alter table public.projects force row level security;
alter table public.milestones force row level security;
alter table public.tasks force row level security;
alter table public.project_activity force row level security;

drop policy if exists "projects_select_org_members" on public.projects;
create policy "projects_select_org_members"
on public.projects
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "projects_insert_org_members" on public.projects;
create policy "projects_insert_org_members"
on public.projects
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "projects_update_org_members" on public.projects;
create policy "projects_update_org_members"
on public.projects
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "projects_delete_none" on public.projects;
create policy "projects_delete_none"
on public.projects
for delete
to authenticated
using (false);

drop policy if exists "milestones_select_org_members" on public.milestones;
create policy "milestones_select_org_members"
on public.milestones
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "milestones_insert_org_members" on public.milestones;
create policy "milestones_insert_org_members"
on public.milestones
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "milestones_update_org_members" on public.milestones;
create policy "milestones_update_org_members"
on public.milestones
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "milestones_delete_none" on public.milestones;
create policy "milestones_delete_none"
on public.milestones
for delete
to authenticated
using (false);

drop policy if exists "tasks_select_org_members" on public.tasks;
create policy "tasks_select_org_members"
on public.tasks
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "tasks_insert_org_members" on public.tasks;
create policy "tasks_insert_org_members"
on public.tasks
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "tasks_update_org_members" on public.tasks;
create policy "tasks_update_org_members"
on public.tasks
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "tasks_delete_none" on public.tasks;
create policy "tasks_delete_none"
on public.tasks
for delete
to authenticated
using (false);

drop policy if exists "project_activity_select_org_members" on public.project_activity;
create policy "project_activity_select_org_members"
on public.project_activity
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "project_activity_insert_org_members" on public.project_activity;
create policy "project_activity_insert_org_members"
on public.project_activity
for insert
to authenticated
with check (public.is_org_member(organization_id));

drop policy if exists "project_activity_update_none" on public.project_activity;
create policy "project_activity_update_none"
on public.project_activity
for update
to authenticated
using (false)
with check (false);

drop policy if exists "project_activity_delete_none" on public.project_activity;
create policy "project_activity_delete_none"
on public.project_activity
for delete
to authenticated
using (false);
