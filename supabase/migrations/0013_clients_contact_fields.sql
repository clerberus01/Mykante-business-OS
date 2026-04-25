alter table public.clients
  add column if not exists contact_name text,
  add column if not exists contact_role text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
