-- A published venue is an immutable snapshot addressed by an unguessable
-- token. Groups that import it get their own editable copy, so later edits on
-- either side stay independent.
create table public.group_venue_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 16 and 64),
  source_group_id uuid references public.groups(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  address text not null check (char_length(address) between 1 and 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index group_venue_shares_source_group_idx
on public.group_venue_shares (source_group_id);

-- Provenance for imported copies: lets a re-import find and reset the
-- existing copy instead of creating a duplicate.
alter table public.group_locations
add column imported_share_id uuid
  references public.group_venue_shares(id) on delete set null;

create unique index group_locations_imported_share_idx
on public.group_locations (group_id, imported_share_id)
where imported_share_id is not null;

alter table public.group_venue_shares enable row level security;

revoke all on public.group_venue_shares from anon, authenticated;
