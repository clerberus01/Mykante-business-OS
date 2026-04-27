alter table public.proposals
add column if not exists public_token uuid not null default gen_random_uuid(),
add column if not exists public_status_enabled boolean not null default true,
add column if not exists public_last_viewed_at timestamptz;

create unique index if not exists proposals_public_token_unique_idx
on public.proposals (public_token);

create index if not exists proposals_public_lookup_idx
on public.proposals (public_token, public_status_enabled)
where deleted_at is null;
