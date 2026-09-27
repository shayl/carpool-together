create type public.group_event_type as enum ('practice', 'game', 'competition');
create type public.group_ride_leg as enum ('to_event', 'from_event');

alter table public.group_access_roster
add constraint group_access_roster_group_id_id_key unique (group_id, id);

alter table public.group_memberships
drop constraint group_memberships_roster_entry_id_fkey,
add constraint group_memberships_roster_entry_fkey
  foreign key (group_id, roster_entry_id)
  references public.group_access_roster(group_id, id)
  on delete set null (roster_entry_id);

create table public.group_households (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  roster_entry_id uuid,
  name text not null check (char_length(name) between 1 and 100),
  address text not null default '' check (char_length(address) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  unique (roster_entry_id),
  foreign key (group_id, roster_entry_id)
    references public.group_access_roster(group_id, id) on delete cascade
);

alter table public.group_access_roster
add column household_id uuid;

alter table public.group_access_roster
add constraint group_access_roster_household_fkey
foreign key (group_id, household_id)
references public.group_households(group_id, id) on delete cascade;

alter table public.participants
add column household_id uuid,
add column roster_entry_id uuid;

insert into public.group_households (group_id, roster_entry_id, name)
select roster.group_id, roster.id, roster.display_name
from public.group_access_roster roster;

update public.group_access_roster roster
set household_id = household.id
from public.group_households household
where household.roster_entry_id = roster.id;

insert into public.group_households (group_id, name)
select participant.group_id, participant.display_name
from public.participants participant
where not exists (
  select 1
  from public.group_access_roster roster
  where roster.group_id = participant.group_id
    and roster.display_name = participant.display_name
);

with roster_matches as (
  select
    participant.id as participant_id,
    roster.id as roster_entry_id,
    roster.household_id,
    row_number() over (
      partition by roster.id
      order by participant.created_at, participant.id
    ) as match_rank
  from public.participants participant
  join public.group_access_roster roster
    on roster.group_id = participant.group_id
   and roster.display_name = participant.display_name
)
update public.participants participant
set
  household_id = roster_matches.household_id,
  roster_entry_id = roster_matches.roster_entry_id
from roster_matches
where participant.id = roster_matches.participant_id
  and roster_matches.match_rank = 1;

update public.participants participant
set household_id = (
  select household.id
  from public.group_households household
  where household.group_id = participant.group_id
    and household.roster_entry_id is null
    and household.name = participant.display_name
  order by household.created_at
  limit 1
)
where participant.household_id is null;

insert into public.participants (
  group_id,
  household_id,
  roster_entry_id,
  display_name
)
select
  roster.group_id,
  roster.household_id,
  roster.id,
  roster.display_name
from public.group_access_roster roster
where not exists (
  select 1
  from public.participants participant
  where participant.roster_entry_id = roster.id
);

alter table public.participants
alter column household_id set not null,
add constraint participants_roster_entry_id_key unique (roster_entry_id),
add constraint participants_household_fkey
  foreign key (group_id, household_id)
  references public.group_households(group_id, id) on delete cascade,
add constraint participants_roster_entry_fkey
  foreign key (group_id, roster_entry_id)
  references public.group_access_roster(group_id, id) on delete cascade;

create table public.group_locations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  address text not null check (char_length(address) between 1 and 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  unique (group_id, id)
);

create table public.group_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_on date not null,
  ends_on date not null,
  start_time time not null,
  end_time time,
  location_id uuid not null,
  needs_to boolean not null default true,
  needs_from boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, id),
  check (ends_on >= starts_on),
  check (end_time is null or end_time > start_time),
  foreign key (group_id, location_id)
    references public.group_locations(group_id, id)
);

create table public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  template_id uuid,
  event_date date not null,
  start_time time not null,
  end_time time,
  location_id uuid not null,
  needs_to boolean not null default true,
  needs_from boolean not null default true,
  event_type public.group_event_type not null default 'practice',
  title text check (title is null or char_length(title) between 1 and 160),
  changed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, id),
  check (end_time is null or end_time > start_time),
  foreign key (group_id, template_id)
    references public.group_schedule_templates(group_id, id)
    on delete set null (template_id),
  foreign key (group_id, location_id)
    references public.group_locations(group_id, id)
);

create unique index group_events_template_date_key
on public.group_events (template_id, event_date)
where template_id is not null;

create table public.group_event_attendance (
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null,
  participant_id uuid not null,
  absent boolean not null default false,
  opt_out_to boolean not null default false,
  opt_out_from boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, participant_id),
  foreign key (group_id, event_id)
    references public.group_events(group_id, id) on delete cascade,
  foreign key (group_id, participant_id)
    references public.participants(group_id, id) on delete cascade
);

create table public.group_ride_claims (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null,
  leg public.group_ride_leg not null,
  household_id uuid not null,
  claimed_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, id),
  unique (event_id, leg),
  foreign key (group_id, event_id)
    references public.group_events(group_id, id) on delete cascade,
  foreign key (group_id, household_id)
    references public.group_households(group_id, id) on delete cascade
);

create table public.group_breaks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text check (label is null or char_length(label) between 1 and 160),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  check (ends_on >= starts_on)
);

create table public.group_absence_periods (
  id uuid primary key default gen_random_uuid(),
  period_group_id uuid not null default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  participant_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  unique (period_group_id, participant_id),
  check (ends_on >= starts_on),
  foreign key (group_id, participant_id)
    references public.participants(group_id, id) on delete cascade
);

create table public.group_activity_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index group_households_group_idx on public.group_households (group_id);
create index group_access_roster_household_idx on public.group_access_roster (group_id, household_id);
create index participants_household_idx on public.participants (group_id, household_id);
create index group_locations_group_idx on public.group_locations (group_id, name);
create index group_templates_group_dates_idx on public.group_schedule_templates (group_id, starts_on, ends_on);
create index group_events_group_date_idx on public.group_events (group_id, event_date);
create index group_attendance_group_event_idx on public.group_event_attendance (group_id, event_id);
create index group_attendance_group_participant_idx on public.group_event_attendance (group_id, participant_id);
create index group_claims_group_event_idx on public.group_ride_claims (group_id, event_id);
create index group_claims_group_household_idx on public.group_ride_claims (group_id, household_id);
create index group_breaks_group_dates_idx on public.group_breaks (group_id, starts_on, ends_on);
create index group_absences_group_participant_dates_idx
  on public.group_absence_periods (group_id, participant_id, starts_on, ends_on);
create index group_absences_period_group_idx on public.group_absence_periods (period_group_id);
create index group_activity_group_created_idx on public.group_activity_log (group_id, created_at desc);

alter table public.group_households enable row level security;
alter table public.group_locations enable row level security;
alter table public.group_schedule_templates enable row level security;
alter table public.group_events enable row level security;
alter table public.group_event_attendance enable row level security;
alter table public.group_ride_claims enable row level security;
alter table public.group_breaks enable row level security;
alter table public.group_absence_periods enable row level security;
alter table public.group_activity_log enable row level security;

create or replace function public.provision_group_roster_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.group_households (
    group_id,
    roster_entry_id,
    name
  )
  values (
    new.group_id,
    new.id,
    new.display_name
  )
  returning id into new_household_id;

  update public.group_access_roster
  set household_id = new_household_id
  where id = new.id;

  insert into public.participants (
    group_id,
    household_id,
    roster_entry_id,
    display_name
  )
  values (
    new.group_id,
    new_household_id,
    new.id,
    new.display_name
  );

  return new;
end;
$$;

create trigger provision_group_roster_schedule_after_insert
after insert on public.group_access_roster
for each row execute function public.provision_group_roster_schedule();

create or replace function public.create_weekly_group_schedule(
  target_group_id uuid,
  target_weekday smallint,
  target_starts_on date,
  target_ends_on date,
  target_start_time time,
  target_end_time time,
  target_location_id uuid,
  target_needs_to boolean,
  target_needs_from boolean,
  target_event_type public.group_event_type default 'practice',
  target_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_template_id uuid;
begin
  if target_weekday not between 1 and 7 then
    raise exception 'Weekday must be between 1 and 7';
  end if;
  if target_ends_on < target_starts_on then
    raise exception 'End date must not precede start date';
  end if;
  if target_end_time is not null and target_end_time <= target_start_time then
    raise exception 'End time must be after start time';
  end if;
  if not exists (
    select 1
    from public.group_locations location
    where location.group_id = target_group_id
      and location.id = target_location_id
  ) then
    raise exception 'Location does not belong to group';
  end if;

  insert into public.group_schedule_templates (
    group_id,
    weekday,
    starts_on,
    ends_on,
    start_time,
    end_time,
    location_id,
    needs_to,
    needs_from
  )
  values (
    target_group_id,
    target_weekday,
    target_starts_on,
    target_ends_on,
    target_start_time,
    target_end_time,
    target_location_id,
    target_needs_to,
    target_needs_from
  )
  returning id into new_template_id;

  insert into public.group_events (
    group_id,
    template_id,
    event_date,
    start_time,
    end_time,
    location_id,
    needs_to,
    needs_from,
    event_type,
    title
  )
  select
    target_group_id,
    new_template_id,
    day::date,
    target_start_time,
    target_end_time,
    target_location_id,
    target_needs_to,
    target_needs_from,
    target_event_type,
    target_title
  from generate_series(
    target_starts_on::timestamp,
    target_ends_on::timestamp,
    interval '1 day'
  ) day
  where extract(isodow from day)::smallint = target_weekday;

  return new_template_id;
end;
$$;

revoke execute on function public.provision_group_roster_schedule() from public;
revoke execute on function public.create_weekly_group_schedule(
  uuid,
  smallint,
  date,
  date,
  time,
  time,
  uuid,
  boolean,
  boolean,
  public.group_event_type,
  text
) from public;
grant execute on function public.create_weekly_group_schedule(
  uuid,
  smallint,
  date,
  date,
  time,
  time,
  uuid,
  boolean,
  boolean,
  public.group_event_type,
  text
) to service_role;

do $$
declare
  table_name text;
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach table_name in array array[
      'group_households',
      'group_locations',
      'group_schedule_templates',
      'group_events',
      'group_event_attendance',
      'group_ride_claims',
      'group_breaks',
      'group_absence_periods'
    ]
    loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          table_name
        );
      end if;
    end loop;
  end if;
end;
$$;
