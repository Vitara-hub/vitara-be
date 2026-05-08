do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'chat_role'
  ) then
    create type public.chat_role as enum ('user', 'assistant', 'system');
  end if;
end
$$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint chat_messages_input_tokens_check check (
    input_tokens is null or input_tokens >= 0
  ),
  constraint chat_messages_output_tokens_check check (
    output_tokens is null or output_tokens >= 0
  )
);

create index if not exists idx_chat_messages_user_id on public.chat_messages (user_id);
create index if not exists idx_chat_messages_session_id on public.chat_messages (session_id, created_at asc);

comment on table public.chat_messages is 'Individual messages for the companion conversation.';
