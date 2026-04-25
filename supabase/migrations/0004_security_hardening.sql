revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.consents to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

revoke all on public.profiles from anon;
revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.audit_logs from anon;
revoke all on public.consents from anon;
revoke all on public.notification_preferences from anon;

revoke all on function public.bootstrap_current_user_organization(text, text) from public;
revoke all on function public.get_auth_bootstrap_status() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;

grant execute on function public.bootstrap_current_user_organization(text, text) to authenticated;
grant execute on function public.get_auth_bootstrap_status() to anon, authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.organization_members force row level security;
alter table public.audit_logs force row level security;
alter table public.consents force row level security;
alter table public.notification_preferences force row level security;

drop policy if exists "profiles_insert_none" on public.profiles;
create policy "profiles_insert_none"
on public.profiles
for insert
to authenticated
with check (false);

drop policy if exists "profiles_delete_none" on public.profiles;
create policy "profiles_delete_none"
on public.profiles
for delete
to authenticated
using (false);

drop policy if exists "organizations_delete_owner" on public.organizations;
create policy "organizations_delete_owner"
on public.organizations
for delete
to authenticated
using (public.has_org_role(id, array['owner']));

drop policy if exists "organization_members_insert_owner_or_admin" on public.organization_members;
create policy "organization_members_insert_owner_or_admin"
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
  and (
    role <> 'owner'
    or public.has_org_role(organization_id, array['owner'])
  )
);

drop policy if exists "organization_members_update_owner_or_admin" on public.organization_members;
create policy "organization_members_update_owner_or_admin"
on public.organization_members
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin'])
  and (
    role <> 'owner'
    or public.has_org_role(organization_id, array['owner'])
  )
);

drop policy if exists "organization_members_delete_owner_only" on public.organization_members;
create policy "organization_members_delete_owner_only"
on public.organization_members
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner'])
  and role <> 'owner'
);

drop policy if exists "audit_logs_update_none" on public.audit_logs;
create policy "audit_logs_update_none"
on public.audit_logs
for update
to authenticated
using (false)
with check (false);

drop policy if exists "audit_logs_delete_none" on public.audit_logs;
create policy "audit_logs_delete_none"
on public.audit_logs
for delete
to authenticated
using (false);

drop policy if exists "consents_delete_admin" on public.consents;
create policy "consents_delete_admin"
on public.consents
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "notification_preferences_delete_self_or_admin" on public.notification_preferences;
create policy "notification_preferences_delete_self_or_admin"
on public.notification_preferences
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);
