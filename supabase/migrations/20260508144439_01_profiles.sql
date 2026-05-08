create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  email text unique,
  full_name text,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format_check check (
    username is null or username ~ '^[a-zA-Z0-9_]{3,30}$'
  )
);

create index if not exists idx_profiles_email on public.profiles (email);

comment on table public.profiles is 'Application-level user profile linked 1:1 with auth.users.';
comment on column public.profiles.id is 'References Supabase auth.users.id.';
