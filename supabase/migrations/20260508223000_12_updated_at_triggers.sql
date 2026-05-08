create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_food_entries_updated_at on public.food_entries;
create trigger set_food_entries_updated_at
before update on public.food_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_sleep_entries_updated_at on public.sleep_entries;
create trigger set_sleep_entries_updated_at
before update on public.sleep_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_typing_sessions_updated_at on public.typing_sessions;
create trigger set_typing_sessions_updated_at
before update on public.typing_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_health_snapshots_updated_at on public.daily_health_snapshots;
create trigger set_daily_health_snapshots_updated_at
before update on public.daily_health_snapshots
for each row execute function public.set_updated_at();
