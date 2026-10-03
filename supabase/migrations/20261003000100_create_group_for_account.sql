-- Creating a group used to copy the creator's name and phone into a fresh
-- roster row, which provisioned an empty household and left them retyping
-- their address, guardians, and riders.
--
-- Now a group is created for an account: everyone sharing that account's
-- family joins the same household, and the family's riders come along. No
-- PIN is generated, because groups no longer have one.

-- Groups made from here have no PIN. The column itself is dropped once no
-- code reads it any more; until then it simply has to accept nothing.
alter table public.groups alter column pin_hash drop not null;

create or replace function public.create_group_for_account(
  group_name text,
  group_slug text,
  auth_user_id uuid,
  account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
  creator_family_id uuid;
  creator_roster_id uuid;
  creator_household_id uuid;
  family_member record;
  family_rider record;
begin
  select family_id into creator_family_id
  from public.accounts
  where id = account_id;

  if creator_family_id is null then
    raise exception 'The account has no family yet';
  end if;

  insert into public.groups (name, slug, timezone, created_by)
  values (group_name, group_slug, 'America/Los_Angeles', auth_user_id)
  returning id into new_group_id;

  -- The trigger links this to the family's household, creating it from the
  -- family's details on first use.
  insert into public.group_access_roster (
    group_id, account_id, display_name, phone, role, active
  )
  select new_group_id, creator.id, coalesce(creator.display_name, 'Member'),
         creator.phone, 'owner', true
  from public.accounts creator
  where creator.id = account_id
  returning id into creator_roster_id;

  -- The trigger fills household_id in a separate statement, so RETURNING
  -- above still holds the pre-trigger null. Read it back.
  select household_id into creator_household_id
  from public.group_access_roster
  where id = creator_roster_id;

  insert into public.group_memberships (
    group_id, user_id, roster_entry_id, role, status
  )
  values (new_group_id, auth_user_id, creator_roster_id, 'owner', 'active');

  -- The other adults in the family (a second parent, a grandparent who
  -- drives) belong in the new group too, in the same household.
  for family_member in
    select id, display_name, phone
    from public.accounts
    where family_id = creator_family_id and id <> account_id
  loop
    insert into public.group_access_roster (
      group_id, account_id, household_id, display_name, phone, role, active
    )
    values (
      new_group_id, family_member.id, creator_household_id,
      coalesce(family_member.display_name, 'Member'), family_member.phone,
      'member', true
    )
    on conflict (group_id, phone) do nothing;
  end loop;

  -- Riders start selected; a group that does not involve one of the children
  -- can remove them.
  for family_rider in
    select id, display_name
    from public.family_riders
    where family_id = creator_family_id
  loop
    insert into public.participants (
      group_id, household_id, family_rider_id, display_name
    )
    values (
      new_group_id, creator_household_id, family_rider.id,
      family_rider.display_name
    );
  end loop;

  return new_group_id;
end;
$$;

revoke execute on function public.create_group_for_account(text, text, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.create_group_for_account(text, text, uuid, uuid)
to service_role;
