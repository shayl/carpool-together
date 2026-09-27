create table public.group_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  reminder_minutes integer not null default 60
    check (reminder_minutes in (15, 30, 60, 90, 120)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index group_push_subscriptions_user_idx
  on public.group_push_subscriptions(user_id);

create table public.group_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.group_push_subscriptions(id) on delete cascade,
  notification_key text not null,
  kind text not null check (kind in ('driver_reminder', 'test')),
  sent_at timestamptz not null default now(),
  unique (subscription_id, notification_key)
);

create index group_push_deliveries_sent_idx
  on public.group_push_deliveries(sent_at);

alter table public.group_push_subscriptions enable row level security;
alter table public.group_push_deliveries enable row level security;

revoke all on public.group_push_subscriptions from anon, authenticated;
revoke all on public.group_push_deliveries from anon, authenticated;
