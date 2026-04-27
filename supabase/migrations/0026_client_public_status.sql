alter table public.clients
add column if not exists public_token uuid not null default gen_random_uuid(),
add column if not exists public_status_enabled boolean not null default true,
add column if not exists public_status_closed_at timestamptz,
add column if not exists public_last_viewed_at timestamptz;

create unique index if not exists clients_public_token_unique_idx
on public.clients (public_token);

create index if not exists clients_public_lookup_idx
on public.clients (public_token, public_status_enabled)
where deleted_at is null;
