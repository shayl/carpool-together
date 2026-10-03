-- Make the person the primary entity instead of the group.
--
-- Until now identity existed only inside a group: you signed in with a phone
-- plus that group's PIN, and `group_access_roster` was the only record of who
-- you are. Joining a second group therefore created a second, unrelated
-- "you" -- with an empty household you had to fill in again.
--
-- This adds an account (phone + personal code) that owns one family, and
-- links the existing per-group rows to it. Per-group tables are kept because
-- ride claims, attendance, absences, drive counts, routes, and push all
-- reference `group_households` / `participants`; replacing them would touch
-- roughly twenty files. Instead a group's household becomes a view of the
-- family, maintained by the writer.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  -- Canonical `normalizePhone` output, so the unique constraint is meaningful.
  phone text not null unique check (char_length(phone) between 7 and 30),
  code_hash text not null,
  -- The first code is derived from the phone, so it is a shared secret with
  -- anyone who knows the number until the owner replaces it.
  must_change_code boolean not null default true,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 100),
  address text not null default '' check (char_length(address) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Two parents share one family, so this is many accounts to one family.
alter table public.accounts
add column family_id uuid references public.families(id) on delete set null;

create index accounts_family_idx on public.accounts (family_id);

-- Binds an anonymous auth.users session to the account it signed in as.
-- Without it there is no way to answer "which account is this device?" for
-- someone who does not belong to a group yet.
create table public.account_devices (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index account_devices_user_idx on public.account_devices (user_id);

-- The family's children. A rider exists once here and is selected into a
-- group by giving them a `participants` row there.
create table public.family_riders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (family_id, id)
);

create index family_riders_family_idx on public.family_riders (family_id);

alter table public.group_households
add column family_id uuid references public.families(id) on delete set null;

create index group_households_family_idx on public.group_households (family_id);

-- A family appears at most once per group. This is what stops the duplicate
-- empty households that made people re-enter their details.
create unique index group_households_group_family_key
on public.group_households (group_id, family_id)
where family_id is not null;

alter table public.group_access_roster
add column account_id uuid references public.accounts(id) on delete set null;

create index group_access_roster_account_idx
on public.group_access_roster (account_id);

alter table public.participants
add column family_rider_id uuid references public.family_riders(id) on delete set null;

create index participants_family_rider_idx
on public.participants (family_rider_id);

alter table public.accounts enable row level security;
alter table public.account_devices enable row level security;
alter table public.families enable row level security;
alter table public.family_riders enable row level security;

revoke all on public.accounts from anon, authenticated;
revoke all on public.account_devices from anon, authenticated;
revoke all on public.families from anon, authenticated;
revoke all on public.family_riders from anon, authenticated;

-- Backfill ------------------------------------------------------------------
-- Temporary columns carry the old identifiers so each new row can be matched
-- back to its source; relying on insert order would be fragile.

alter table public.families add column legacy_household_id uuid;

insert into public.families (name, address, latitude, longitude, legacy_household_id)
select name, address, latitude, longitude, id
from public.group_households;

update public.group_households household
set family_id = family.id
from public.families family
where family.legacy_household_id = household.id;

alter table public.families drop column legacy_household_id;

alter table public.family_riders add column legacy_participant_id uuid;

-- Participants with a roster entry are the adults themselves, not riders.
insert into public.family_riders (family_id, display_name, legacy_participant_id)
select household.family_id, participant.display_name, participant.id
from public.participants participant
join public.group_households household on household.id = participant.household_id
where participant.roster_entry_id is null
  and household.family_id is not null;

update public.participants participant
set family_rider_id = rider.id
from public.family_riders rider
where rider.legacy_participant_id = participant.id;

alter table public.family_riders drop column legacy_participant_id;

-- One account per distinct phone. The sentinel hash cannot match any bcrypt
-- comparison, so nobody can sign in until scripts/seed-initial-codes.ts
-- replaces it with a hash of their phone's last six digits.
insert into public.accounts (phone, code_hash, display_name)
select phone, 'pending-seed', min(display_name)
from public.group_access_roster
group by phone;

update public.group_access_roster roster
set account_id = account.id
from public.accounts account
where account.phone = roster.phone;

-- Attach each account to the family behind its household. `distinct on` keeps
-- this deterministic if a phone ever appears in more than one group.
update public.accounts account
set family_id = chosen.family_id
from (
  select distinct on (roster.account_id)
    roster.account_id,
    household.family_id
  from public.group_access_roster roster
  join public.group_households household on household.id = roster.household_id
  where roster.account_id is not null
    and household.family_id is not null
  order by roster.account_id, roster.created_at
) chosen
where chosen.account_id = account.id;

do $$
declare
  conflicting int;
begin
  select count(*) into conflicting
  from (
    select roster.account_id
    from public.group_access_roster roster
    join public.group_households household on household.id = roster.household_id
    where roster.account_id is not null and household.family_id is not null
    group by roster.account_id
    having count(distinct household.family_id) > 1
  ) duplicates;

  if conflicting > 0 then
    raise warning
      'ATTENTION: % account(s) belong to more than one family; only the earliest was kept.',
      conflicting;
  end if;
end $$;

-- Roster inserts no longer mint a household -------------------------------
-- Previously every roster insert created a household and a participant. That
-- is what produced an empty family each time someone joined or created a
-- group. Now a roster row joins the household its family already has in that
-- group, and only creates one when the family has yet to appear there.

create or replace function public.provision_group_roster_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
  target_family_id uuid;
begin
  if new.household_id is not null then
    target_household_id := new.household_id;
  else
    select family_id into target_family_id
    from public.accounts
    where id = new.account_id;

    if target_family_id is not null then
      select id into target_household_id
      from public.group_households
      where group_id = new.group_id and family_id = target_family_id;

      if target_household_id is null then
        insert into public.group_households (
          group_id, family_id, name, address, latitude, longitude
        )
        select new.group_id, family.id, family.name, family.address,
               family.latitude, family.longitude
        from public.families family
        where family.id = target_family_id
        returning id into target_household_id;
      end if;
    else
      -- No account yet: an organizer added a phone belonging to someone who
      -- has never signed in. Give them their own household, as before; it is
      -- adopted into their family once they sign in.
      insert into public.group_households (group_id, roster_entry_id, name)
      values (new.group_id, new.id, new.display_name)
      returning id into target_household_id;
    end if;

    update public.group_access_roster
    set household_id = target_household_id
    where id = new.id;
  end if;

  -- The adult's own participant row. Riders are added separately, per group.
  insert into public.participants (
    group_id, household_id, roster_entry_id, display_name
  )
  values (new.group_id, target_household_id, new.id, new.display_name)
  on conflict (roster_entry_id) do nothing;

  return new;
end;
$$;
