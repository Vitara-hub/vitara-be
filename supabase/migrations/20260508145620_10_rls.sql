alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.sleep_entries enable row level security;
alter table public.typing_sessions enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.daily_health_snapshots enable row level security;
alter table public.request_delete_user_data enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "food_entries_all_own" on public.food_entries;
create policy "food_entries_all_own"
on public.food_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sleep_entries_all_own" on public.sleep_entries;
create policy "sleep_entries_all_own"
on public.sleep_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "typing_sessions_all_own" on public.typing_sessions;
create policy "typing_sessions_all_own"
on public.typing_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_all_own" on public.chat_sessions;
create policy "chat_sessions_all_own"
on public.chat_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
on public.chat_messages
for select
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
on public.chat_messages
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.chat_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own"
on public.chat_messages
for delete
using (auth.uid() = user_id);

drop policy if exists "daily_health_snapshots_all_own" on public.daily_health_snapshots;
create policy "daily_health_snapshots_all_own"
on public.daily_health_snapshots
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "request_delete_user_data_select_own" on public.request_delete_user_data;
create policy "request_delete_user_data_select_own"
on public.request_delete_user_data
for select
using (auth.uid() = user_id);

drop policy if exists "request_delete_user_data_insert_own" on public.request_delete_user_data;
create policy "request_delete_user_data_insert_own"
on public.request_delete_user_data
for insert
with check (auth.uid() = user_id);
