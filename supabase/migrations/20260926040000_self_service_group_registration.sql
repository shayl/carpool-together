create table public.group_registration_attempts (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  registered_at timestamptz not null default now()
);

create index group_registration_attempts_identifier_time_idx
on public.group_registration_attempts (identifier_hash, registered_at desc);

alter table public.group_registration_attempts enable row level security;

create function public.register_group(
  group_name text,
  group_slug text,
  group_pin_hash text,
  member_name text,
  member_phone text,
  auth_user_id uuid,
  registration_identifier_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
  new_roster_entry_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(registration_identifier_hash, 0)
  );

  if not exists (
    select 1
    from auth.users
    where id = auth_user_id
      and is_anonymous = true
  ) then
    raise exception 'A valid anonymous device session is required';
  end if;

  if exists (
    select 1
    from public.group_memberships
    where user_id = auth_user_id
      and status = 'active'
  ) then
    raise exception 'Registration requires a device that does not already belong to a group';
  end if;

  if (
    select count(*)
    from public.group_registration_attempts
    where identifier_hash = registration_identifier_hash
      and registered_at >= now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Registration rate limit exceeded';
  end if;

  insert into public.group_registration_attempts (identifier_hash)
  values (registration_identifier_hash);

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
  )
  returning id into new_roster_entry_id;

  insert into public.group_memberships (
    group_id,
    user_id,
    roster_entry_id,
    role,
    status
  )
  values (
    new_group_id,
    auth_user_id,
    new_roster_entry_id,
    'owner',
    'active'
  );

  update public.profiles
  set display_name = member_name
  where user_id = auth_user_id;

  return new_group_id;
end;
$$;

revoke execute on function public.register_group(
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) from public;

grant execute on function public.register_group(
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) to service_role;
