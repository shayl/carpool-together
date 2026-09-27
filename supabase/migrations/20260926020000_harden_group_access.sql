alter table public.group_memberships
add column roster_entry_id uuid references public.group_access_roster(id)
on delete set null;

alter table public.groups
alter column pin_hash set not null;

create table public.auth_login_attempts (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  attempted_at timestamptz not null default now()
);

create index auth_login_attempts_identifier_time_idx
on public.auth_login_attempts (identifier_hash, attempted_at desc);

alter table public.auth_login_attempts enable row level security;

create or replace function public.bootstrap_first_group(
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
  new_roster_entry_id uuid;
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

create function public.create_additional_group(
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
  new_roster_entry_id uuid;
begin
  if not exists (
    select 1
    from public.group_memberships
    where user_id = auth_user_id
      and status = 'active'
  ) then
    raise exception 'An active group membership is required';
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

  return new_group_id;
end;
$$;

revoke execute on function public.create_additional_group(
  text,
  text,
  text,
  text,
  text,
  uuid
) from public;

grant execute on function public.create_additional_group(
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
