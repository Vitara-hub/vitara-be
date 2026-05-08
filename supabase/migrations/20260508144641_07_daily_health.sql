create table if not exists public.daily_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  snapshot_date date not null,
  mood_score integer,
  nutrition_score integer,
  sleep_score integer,
  stress_score integer,
  overall_health_score integer,
  insight_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_health_snapshots_unique unique (user_id, snapshot_date),
  constraint daily_health_snapshots_mood_score_check check (
    mood_score is null or (mood_score between 0 and 100)
  ),
  constraint daily_health_snapshots_nutrition_score_check check (
    nutrition_score is null or (nutrition_score between 0 and 100)
  ),
  constraint daily_health_snapshots_sleep_score_check check (
    sleep_score is null or (sleep_score between 0 and 100)
  ),
  constraint daily_health_snapshots_stress_score_check check (
    stress_score is null or (stress_score between 0 and 100)
  ),
  constraint daily_health_snapshots_overall_health_score_check check (
    overall_health_score is null or (overall_health_score between 0 and 100)
  )
);

create index if not exists idx_daily_health_snapshots_user_date on public.daily_health_snapshots (user_id, snapshot_date desc);

comment on table public.daily_health_snapshots is 'Daily aggregated health score returned by AI service and stored by gateway.';
