create extension if not exists pgcrypto;

create type public.group_role as enum ('owner', 'admin', 'coordinator', 'member');
create type public.membership_status as enum ('active', 'invited', 'suspended');
create type public.event_leg_kind as enum ('outbound', 'return');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Los_Angeles',
  accent_color text not null default '#e06342'
    check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (group_id, id)
);

create table public.participant_managers (
  group_id uuid not null,
  participant_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null check (relationship in ('self', 'guardian', 'delegate')),
  created_at timestamptz not null default now(),
  primary key (participant_id, user_id),
  foreign key (group_id, participant_id)
    references public.participants(group_id, id) on delete cascade,
  foreign key (group_id, user_id)
    references public.group_memberships(group_id, user_id) on delete cascade
);

create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  participant_id uuid not null,
  label text not null check (char_length(label) between 1 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (group_id, id),
  foreign key (group_id, participant_id)
    references public.participants(group_id, id) on delete cascade
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  destination_label text not null,
  destination_latitude double precision not null
    check (destination_latitude between -90 and 90),
  destination_longitude double precision not null
    check (destination_longitude between -180 and 180),
  created_at timestamptz not null default now(),
  unique (group_id, id)
);

create table public.event_legs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null,
  kind public.event_leg_kind not null,
  revision integer not null default 1 check (revision > 0),
  unique (event_id, kind),
  unique (group_id, id),
  foreign key (group_id, event_id)
    references public.events(group_id, id) on delete cascade
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_user_id uuid not null,
  label text not null check (char_length(label) between 1 and 100),
  passenger_seats smallint not null check (passenger_seats between 1 and 12),
  unique (group_id, id),
  foreign key (group_id, owner_user_id)
    references public.group_memberships(group_id, user_id) on delete cascade
);

create table public.driver_offers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_leg_id uuid not null,
  driver_user_id uuid not null,
  vehicle_id uuid not null,
  origin_location_id uuid not null,
  status text not null default 'offered'
    check (status in ('offered', 'proposed', 'accepted', 'declined')),
  unique (event_leg_id, driver_user_id),
  unique (group_id, id),
  foreign key (group_id, event_leg_id)
    references public.event_legs(group_id, id) on delete cascade,
  foreign key (group_id, driver_user_id)
    references public.group_memberships(group_id, user_id) on delete cascade,
  foreign key (group_id, vehicle_id)
    references public.vehicles(group_id, id),
  foreign key (group_id, origin_location_id)
    references public.pickup_locations(group_id, id)
);

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_leg_id uuid not null,
  participant_id uuid not null,
  pickup_location_id uuid not null,
  status text not null default 'requested'
    check (status in ('requested', 'assigned', 'cancelled')),
  unique (event_leg_id, participant_id),
  unique (group_id, id),
  foreign key (group_id, event_leg_id)
    references public.event_legs(group_id, id) on delete cascade,
  foreign key (group_id, participant_id)
    references public.participants(group_id, id) on delete cascade,
  foreign key (group_id, pickup_location_id)
    references public.pickup_locations(group_id, id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_leg_id uuid not null,
  driver_offer_id uuid not null,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft'
    check (status in ('draft', 'proposed', 'accepted', 'cancelled')),
  unique (driver_offer_id),
  unique (group_id, id),
  foreign key (group_id, event_leg_id)
    references public.event_legs(group_id, id) on delete cascade,
  foreign key (group_id, driver_offer_id)
    references public.driver_offers(group_id, id) on delete cascade
);

create table public.rider_assignments (
  group_id uuid not null,
  trip_id uuid not null,
  ride_request_id uuid not null unique,
  stop_order smallint not null check (stop_order > 0),
  primary key (trip_id, ride_request_id),
  foreign key (group_id, trip_id)
    references public.trips(group_id, id) on delete cascade,
  foreign key (group_id, ride_request_id)
    references public.ride_requests(group_id, id) on delete cascade
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'New member')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_group(
  group_name text,
  group_slug text,
  group_timezone text default 'America/Los_Angeles'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.groups (name, slug, timezone, created_by)
  values (group_name, group_slug, group_timezone, auth.uid())
  returning id into new_group_id;

  insert into public.group_memberships (group_id, user_id, role, status)
  values (new_group_id, auth.uid(), 'owner', 'active');

  return new_group_id;
end;
$$;

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create or replace function public.has_group_role(
  target_group_id uuid,
  allowed_roles public.group_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_memberships membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.participants enable row level security;
alter table public.participant_managers enable row level security;
alter table public.pickup_locations enable row level security;
alter table public.events enable row level security;
alter table public.event_legs enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_offers enable row level security;
alter table public.ride_requests enable row level security;
alter table public.trips enable row level security;
alter table public.rider_assignments enable row level security;

create policy "users read own profile"
on public.profiles for select
using (user_id = auth.uid());

create policy "members read groups"
on public.groups for select
using (public.is_group_member(id));

create policy "members read memberships"
on public.group_memberships for select
using (public.is_group_member(group_id));

create policy "members read participants"
on public.participants for select
using (public.is_group_member(group_id));

create policy "coordinators manage participants"
on public.participants for all
using (
  public.has_group_role(
    group_id,
    array['owner', 'admin', 'coordinator']::public.group_role[]
  )
)
with check (
  public.has_group_role(
    group_id,
    array['owner', 'admin', 'coordinator']::public.group_role[]
  )
);

create policy "managers read pickup locations"
on public.pickup_locations for select
using (
  exists (
    select 1
    from public.participant_managers manager
    where manager.group_id = pickup_locations.group_id
      and manager.participant_id = pickup_locations.participant_id
      and manager.user_id = auth.uid()
  )
);

create policy "members read events"
on public.events for select
using (public.is_group_member(group_id));

create policy "members read event legs"
on public.event_legs for select
using (public.is_group_member(group_id));

create policy "members read vehicles"
on public.vehicles for select
using (public.is_group_member(group_id));

create policy "members read driver offers"
on public.driver_offers for select
using (public.is_group_member(group_id));

create policy "members read ride requests"
on public.ride_requests for select
using (public.is_group_member(group_id));

create policy "members read trips"
on public.trips for select
using (public.is_group_member(group_id));

create policy "members read rider assignments"
on public.rider_assignments for select
using (public.is_group_member(group_id));

revoke execute on function public.is_group_member(uuid) from public;
revoke execute on function public.has_group_role(uuid, public.group_role[]) from public;
revoke execute on function public.create_group(text, text, text) from public;
revoke execute on function public.handle_new_user() from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.has_group_role(uuid, public.group_role[]) to authenticated;
grant execute on function public.create_group(text, text, text) to authenticated;
