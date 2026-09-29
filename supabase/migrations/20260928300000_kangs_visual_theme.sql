alter table public.groups
alter column accent_color set default '#5b4bdb';

update public.groups
set accent_color = '#5b4bdb'
where accent_color = '#e06342';
