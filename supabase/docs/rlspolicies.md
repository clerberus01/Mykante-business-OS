# RLS policies

This document is the central index for Supabase row-level security in Mykante Business OS.

## Principles

- Browser clients use the anon key and must depend on RLS for all tenant isolation.
- Server-only code may use service-role credentials, but service-role keys must never be exposed to Vite or browser bundles.
- Organization-scoped tables must include `organization_id` and restrict access with `public.is_org_member(organization_id)`.
- Owner/admin-only mutations must use `public.has_org_role(organization_id, array['owner', 'admin'])` or a stricter role set.
- Soft-deleted records must stay hidden from normal select policies unless an admin recovery workflow explicitly needs them.

## Helper functions

- `public.is_org_member(org_id uuid)`: checks whether `auth.uid()` has an active membership in the organization.
- `public.has_org_role(org_id uuid, roles text[])`: checks active membership and role authorization.
- `public.bootstrap_current_user_organization(org_name text, org_slug text)`: creates the first owner workspace only when no active membership exists. Existing members can rehydrate their context. The function uses an advisory transaction lock to avoid parallel first-admin creation.
- `public.get_auth_bootstrap_status()`: returns whether the first admin flow can still be used.

## Core policy groups

### Profiles

- Authenticated users can read/update their own profile.
- Profile creation from the browser is denied; bootstrap/server flows create the row.
- Deletes are denied.

### Organizations

- Active members can read their organization.
- Authenticated bootstrap may insert the first organization through the security-definer function.
- Owners can delete organizations when a delete policy is enabled; normal app flows should prefer soft delete.

### Organization members

- Active members can read memberships inside their organization.
- Owners/admins can invite or update members.
- Only owners can grant owner role.
- Owners cannot be deleted through normal member-delete policy.

### CRM, projects, documents, finance, proposals, WhatsApp, calendar and tasks

- Select/insert/update policies must be scoped by `organization_id`.
- Delete policies should be owner/admin-only unless the table has a narrower business rule.
- Tables with `deleted_at` should filter deleted rows in select policies and prefer soft delete from the application.

### Audit, consent and notification tables

- Audit logs are append-only for authenticated users; update/delete are denied.
- Consent and notification preferences are visible to the owning user or organization admins.
- Notification preference deletion is allowed for the owning user or admins.

### Storage

- Buckets that store organization data must encode the organization id in the object path and validate it against active membership.
- Public buckets are only acceptable for non-sensitive generated assets.
- Profile avatar storage should allow the authenticated user to manage only their own avatar path.

## Operational checklist

- Every new table must enable and force RLS before frontend integration.
- Every organization-scoped table must have tests or SQL review confirming tenant isolation.
- Any security-definer function must set `search_path = public`, revoke from `public`, and grant only the required roles.
- Auth rate limits for sign-in and sign-up must be configured in Supabase Auth or enforced by a server endpoint before production launch.
