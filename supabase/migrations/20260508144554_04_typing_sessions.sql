create table if not exists public.typing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wpm numeric(6,2) not null,
  duration integer not null,
  text_content text not null,
  backspace_rate numeric(5,4),
  typing_variance float,
  inter_key_timing jsonb,
  stress_score numeric(5,4),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_typing_sessions_user_id on public.typing_sessions (user_id);
create index if not exists idx_typing_sessions_created_at on public.typing_sessions (created_at desc);
create index if not exists idx_typing_sessions_user_created_at on public.typing_sessions (user_id, created_at desc);

comment on table public.typing_sessions is 'Keystroke and typing telemetry used for stress analysis.';
