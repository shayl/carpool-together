alter table public.groups
add column icon_path text
check (icon_path is null or char_length(icon_path) between 1 and 500);

alter table public.group_access_roster
add column photo_path text
check (photo_path is null or char_length(photo_path) between 1 and 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'group-images',
  'group-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
