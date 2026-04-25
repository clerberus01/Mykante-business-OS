create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel public.notification_channel not null,
  provider text not null,
  provider_subscription_id text,
  endpoint text,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'revoked')),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists notification_subscriptions_provider_unique_idx
on public.notification_subscriptions (organization_id, user_id, channel, provider);

create index if not exists notification_subscriptions_user_idx
on public.notification_subscriptions (user_id, channel, status);

drop trigger if exists set_notification_subscriptions_updated_at on public.notification_subscriptions;
create trigger set_notification_subscriptions_updated_at
before update on public.notification_subscriptions
for each row
execute function public.set_updated_at();

create table if not exists public.notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  channel public.notification_channel not null,
  provider text not null,
  template_key text,
  recipient text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  external_message_id text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz
);

create index if not exists notification_dispatches_org_created_at_idx
on public.notification_dispatches (organization_id, created_at desc);

create index if not exists notification_dispatches_user_idx
on public.notification_dispatches (user_id, created_at desc);

revoke all on public.notification_subscriptions from anon;
revoke all on public.notification_dispatches from anon;

grant select, insert, update on public.notification_subscriptions to authenticated;
grant select on public.notification_dispatches to authenticated;

alter table public.notification_subscriptions enable row level security;
alter table public.notification_dispatches enable row level security;

alter table public.notification_subscriptions force row level security;
alter table public.notification_dispatches force row level security;

drop policy if exists "notification_subscriptions_select_self_or_admin" on public.notification_subscriptions;
create policy "notification_subscriptions_select_self_or_admin"
on public.notification_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "notification_subscriptions_insert_self_or_admin" on public.notification_subscriptions;
create policy "notification_subscriptions_insert_self_or_admin"
on public.notification_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "notification_subscriptions_update_self_or_admin" on public.notification_subscriptions;
create policy "notification_subscriptions_update_self_or_admin"
on public.notification_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
)
with check (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin'])
);

drop policy if exists "notification_dispatches_select_self_or_admin" on public.notification_dispatches;
create policy "notification_dispatches_select_self_or_admin"
on public.notification_dispatches
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);
