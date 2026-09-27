create function public.bootstrap_first_group(
  group_name text,
  group_slug text,
  group_pin_hash text,
  member_name text,
  member_phone text,
  auth_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
begin
  if exists (select 1 from public.groups) then
    raise exception 'The first group has already been set up';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = auth_user_id
      and is_anonymous = true
  ) then
    raise exception 'A valid anonymous device session is required';
  end if;

  insert into public.groups (
    name,
    slug,
    timezone,
    pin_hash,
    created_by
  )
  values (
    group_name,
    group_slug,
    'America/Los_Angeles',
    group_pin_hash,
    auth_user_id
  )
  returning id into new_group_id;

  insert into public.group_access_roster (
    group_id,
    display_name,
    phone,
    role
  )
  values (
    new_group_id,
    member_name,
    member_phone,
    'owner'
  );

  insert into public.group_memberships (group_id, user_id, role, status)
  values (new_group_id, auth_user_id, 'owner', 'active');

  update public.profiles
  set display_name = member_name
  where user_id = auth_user_id;

  return new_group_id;
end;
$$;

revoke execute on function public.bootstrap_first_group(
  text,
  text,
  text,
  text,
  text,
  uuid
) from public;

grant execute on function public.bootstrap_first_group(
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
