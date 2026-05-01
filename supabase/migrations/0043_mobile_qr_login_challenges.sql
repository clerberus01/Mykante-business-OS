create table if not exists public.mobile_qr_login_challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_location jsonb not null default '{}'::jsonb,
  consumed_ip text,
  created_at timestamptz not null default now(),
  created_ip text
);

create index if not exists mobile_qr_login_challenges_user_idx
on public.mobile_qr_login_challenges (user_id, created_at desc);

create index if not exists mobile_qr_login_challenges_code_active_idx
on public.mobile_qr_login_challenges (code, expires_at)
where consumed_at is null;

alter table public.mobile_qr_login_challenges enable row level security;

drop policy if exists "mobile qr challenges are service role only" on public.mobile_qr_login_challenges;
create policy "mobile qr challenges are service role only"
on public.mobile_qr_login_challenges
for all
using (false)
with check (false);
