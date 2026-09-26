alter table public.groups
add column pin_hash text;

create table public.group_access_roster (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  phone text not null check (char_length(phone) between 7 and 30),
  role public.group_role not null default 'member',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, phone)
);

create index group_access_roster_phone_idx
on public.group_access_roster (phone)
where active;

alter table public.group_access_roster enable row level security;

drop function public.create_group(text, text, text);

create function public.create_group(
  group_name text,
  group_slug text,
  group_pin text,
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

  if char_length(group_pin) < 4 or char_length(group_pin) > 12 then
    raise exception 'Group PIN must contain 4 to 12 characters';
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
    group_timezone,
    extensions.crypt(group_pin, extensions.gen_salt('bf')),
    auth.uid()
  )
  returning id into new_group_id;

  insert into public.group_memberships (group_id, user_id, role, status)
  values (new_group_id, auth.uid(), 'owner', 'active');

  return new_group_id;
end;
$$;

revoke execute on function public.create_group(text, text, text, text)
from public;

grant execute on function public.create_group(text, text, text, text)
to authenticated;
