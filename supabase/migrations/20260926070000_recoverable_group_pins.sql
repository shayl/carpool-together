alter table public.groups
add column pin_ciphertext text;

create function public.register_group_with_recoverable_pin(
  group_name text,
  group_slug text,
  group_pin_hash text,
  group_pin_fingerprint text,
  group_pin_ciphertext text,
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
  new_group_id := public.register_group_with_generated_pin(
    group_name,
    group_slug,
    group_pin_hash,
    group_pin_fingerprint,
    member_name,
    member_phone,
    auth_user_id,
    registration_identifier_hash
  );

  update public.groups
  set pin_ciphertext = group_pin_ciphertext
  where id = new_group_id;

  return new_group_id;
end;
$$;

revoke execute on function public.register_group_with_recoverable_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) from public;

grant execute on function public.register_group_with_recoverable_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
) to service_role;

create function public.create_additional_group_with_recoverable_pin(
  group_name text,
  group_slug text,
  group_pin_hash text,
  group_pin_fingerprint text,
  group_pin_ciphertext text,
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
  new_group_id := public.create_additional_group_with_generated_pin(
    group_name,
    group_slug,
    group_pin_hash,
    group_pin_fingerprint,
    member_name,
    member_phone,
    auth_user_id
  );

  update public.groups
  set pin_ciphertext = group_pin_ciphertext
  where id = new_group_id;

  return new_group_id;
end;
$$;

revoke execute on function public.create_additional_group_with_recoverable_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) from public;

grant execute on function public.create_additional_group_with_recoverable_pin(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
