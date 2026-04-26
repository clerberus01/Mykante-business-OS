drop policy if exists "tasks_delete_none" on public.tasks;
drop policy if exists "tasks_delete_org_members" on public.tasks;

create policy "tasks_delete_org_members"
on public.tasks
for delete
to authenticated
using (public.is_org_member(organization_id));
