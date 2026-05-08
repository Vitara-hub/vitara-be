create table if not exists public.request_delete_user_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default timezone('utc', now()),
  processed boolean not null default false,
  processed_at timestamptz
);