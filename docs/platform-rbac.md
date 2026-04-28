# Platform RBAC Boundary

There are two different admin layers:

- Platform admin: manages the SaaS/system itself. Stored in `public.platform_admins`.
- Organization owner/admin: manages only one organization. Stored in `public.organization_members`.

Organization roles must never imply platform access. A user with `owner` or `admin` in an organization can manage that organization's members, settings and data only through `organization_id` scoped RLS.

Platform admin access is checked only through `public.is_platform_admin()`, which requires:

- authenticated user
- verified MFA session (`aal2`)
- active row in `public.platform_admins`

The first platform admin is claimed once through `public.claim_initial_platform_admin()`. After one active platform admin exists, the claim function refuses further bootstrap.

Do not add platform-admin bypasses to organization data policies unless the feature is explicitly a platform support/audit feature and is reviewed separately. Normal CRM, finance, project, document and communication data must remain organization-scoped.
