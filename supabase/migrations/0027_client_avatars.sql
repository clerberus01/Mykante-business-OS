alter table public.clients
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-avatars',
  'client-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "client_avatars_select_public" on storage.objects;
create policy "client_avatars_select_public"
on storage.objects
for select
to public
using (bucket_id = 'client-avatars');

drop policy if exists "client_avatars_insert_org_members" on storage.objects;
create policy "client_avatars_insert_org_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "client_avatars_update_org_members" on storage.objects;
create policy "client_avatars_update_org_members"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'client-avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "client_avatars_delete_org_members" on storage.objects;
create policy "client_avatars_delete_org_members"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
