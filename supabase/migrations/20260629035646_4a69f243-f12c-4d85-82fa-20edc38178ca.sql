
-- Drop auto-signup trigger; accounts are now seeded explicitly.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Fixed-accounts table: always exactly 3 rows.
create table public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  role public.app_role not null unique,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.app_accounts to authenticated;
grant all on public.app_accounts to service_role;

alter table public.app_accounts enable row level security;

create policy "App accounts readable by authenticated"
  on public.app_accounts for select to authenticated using (true);

-- No insert/delete policy: only service_role (via seed function) may manage rows.

create trigger app_accounts_touch before update on public.app_accounts
  for each row execute function public.touch_updated_at();

-- Resolve a username (case-insensitive) into the internal e-mail used by Supabase auth.
-- Called by the anonymous login screen; intentionally exposed via security definer
-- so anon can map username -> email without seeing the table.
create or replace function public.resolve_login(_username text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email
  from public.app_accounts a
  join auth.users u on u.id = a.auth_user_id
  where lower(a.username) = lower(_username)
  limit 1
$$;

revoke execute on function public.resolve_login(text) from public;
grant execute on function public.resolve_login(text) to anon, authenticated;
