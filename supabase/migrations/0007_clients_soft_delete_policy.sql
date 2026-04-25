drop policy if exists "clients_select_org_members" on public.clients;

create policy "clients_select_org_members"
on public.clients
for select
to authenticated
using (
  public.is_org_member(organization_id)
);
