create table if not exists public.sleep_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  quality smallint not null,
  notes text,
  ai_quality_score integer,
  sleep_debt_hours numeric(5,2),
  interruptions integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sleep_entries_quality_check check (quality between 1 and 5),
  constraint sleep_entries_time_check check (end_time > start_time),
  constraint sleep_entries_ai_quality_score_check check (
    ai_quality_score is null or (ai_quality_score between 0 and 100)
  ),
  constraint sleep_entries_sleep_debt_check check (
    sleep_debt_hours is null or sleep_debt_hours >= 0
  ),
  constraint sleep_entries_interruptions_check check (
    interruptions is null or interruptions >= 0
  )
);

create index if not exists idx_sleep_entries_user_id on public.sleep_entries (user_id);
create index if not exists idx_sleep_entries_start_time on public.sleep_entries (start_time desc);
create index if not exists idx_sleep_entries_user_start_time on public.sleep_entries (user_id, start_time desc);

comment on table public.sleep_entries is 'User sleep logs with optional AI-derived quality metadata.';
