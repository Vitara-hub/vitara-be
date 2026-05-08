create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  summary text,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_sessions_user_id on public.chat_sessions (user_id);
create index if not exists idx_chat_sessions_last_message_at on public.chat_sessions (last_message_at desc nulls last);

comment on table public.chat_sessions is 'Conversation container for companion chat.';
