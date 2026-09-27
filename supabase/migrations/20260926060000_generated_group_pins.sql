alter table public.groups
add column pin_fingerprint text;

create unique index groups_pin_fingerprint_key
on public.groups (pin_fingerprint)
where pin_fingerprint is not null;

create function public.register_group_with_generated_pin(
  group_name text,
  group_slug text,
  group_pin_hash text,
  group_pin_fingerprint text,
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
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(group_pin_fingerprint, 0)
  );

  new_group_id := public.register_group(
    group_name,
    group_slug,
    group_pin_hash,
    member_name,
    member_phone,
    auth_user_id,
    registration_identifier_hash
  );

  update public.groups
  set pin_fingerprint = group_pin_fingerprint
  where id = new_group_id;

  return new_group_id;
end;
$$;

revoke execute on function public.register_group_with_generated_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) from public;

grant execute on function public.register_group_with_generated_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) to service_role;

create function public.create_additional_group_with_generated_pin(
  group_name text,
  group_slug text,
  group_pin_hash text,
  group_pin_fingerprint text,
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
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(group_pin_fingerprint, 0)
  );

  new_group_id := public.create_additional_group(
    group_name,
    group_slug,
    group_pin_hash,
    member_name,
    member_phone,
    auth_user_id
  );

  update public.groups
  set pin_fingerprint = group_pin_fingerprint
  where id = new_group_id;

  return new_group_id;
end;
$$;

revoke execute on function public.create_additional_group_with_generated_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) from public;

grant execute on function public.create_additional_group_with_generated_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
