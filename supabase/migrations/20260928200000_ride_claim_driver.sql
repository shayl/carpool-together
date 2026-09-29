-- Claims stay per household so driving fairness and shared responsibility
-- still work when two parents share one household, but record which adult
-- actually committed to the ride.
alter table public.group_ride_claims
add column driver_roster_entry_id uuid;

alter table public.group_ride_claims
add constraint group_ride_claims_driver_fkey
foreign key (group_id, driver_roster_entry_id)
references public.group_access_roster(group_id, id) on delete set null;

create index group_ride_claims_driver_idx
on public.group_ride_claims (driver_roster_entry_id)
where driver_roster_entry_id is not null;
