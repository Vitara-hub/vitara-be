create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  calories integer not null,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  image_url text,
  ai_food_label text,
  ai_confidence numeric(5,4),
  source text not null default 'manual',
  food_image_url text default null,
  consumed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint food_entries_calories_check check (calories >= 0),
  constraint food_entries_protein_check check (protein >= 0),
  constraint food_entries_carbs_check check (carbs >= 0),
  constraint food_entries_fat_check check (fat >= 0),
  constraint food_entries_ai_confidence_check check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  )
);

create index if not exists idx_food_entries_user_id on public.food_entries (user_id);
create index if not exists idx_food_entries_consumed_at on public.food_entries (consumed_at desc);
create index if not exists idx_food_entries_user_consumed_at on public.food_entries (user_id, consumed_at desc);

comment on table public.food_entries is 'User food logs, either manual or AI-assisted.';
