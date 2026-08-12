-- App-level Snibble settings + admin tools.
--
-- Adds:
--   1. sn_app_settings table (flat key/value flags; admins can write)
--   2. DELETE policy on sn_daily_feeds for self (so users can redo today)
--   3. sn_admin_reset_leaderboard() — admin-only RPC that wipes all
--      sn_daily_feeds rows. Used to clear test scores before public
--      launch. Pet growth (sn_progress) is NOT touched — only the
--      leaderboard / daily-session history.

-- ─────────────────────────────────────────────────────────────────────
-- 1. sn_app_settings
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sn_app_settings enable row level security;

drop policy if exists "sn_app_settings read for all" on public.sn_app_settings;
create policy "sn_app_settings read for all" on public.sn_app_settings
  for select to authenticated using (true);

drop policy if exists "sn_app_settings write for admins" on public.sn_app_settings;
create policy "sn_app_settings write for admins" on public.sn_app_settings
  for all to authenticated
  using (exists (select 1 from public.admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.user_id = auth.uid()));

insert into public.sn_app_settings (key, value) values ('redo_today_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 2. DELETE policy on sn_daily_feeds — users can delete their OWN
--    daily-feed row. Used by the in-app "Redo today" testing feature.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "sn_daily_feeds delete own" on public.sn_daily_feeds;
create policy "sn_daily_feeds delete own" on public.sn_daily_feeds
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. sn_admin_reset_leaderboard — wipes all daily-feed rows.
--    SECURITY DEFINER so it bypasses RLS, but checks caller is an admin.
--    Deliberately leaves sn_progress untouched: pets keep their growth.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sn_admin_reset_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admins where admins.user_id = auth.uid()) then
    raise exception 'sn_admin_reset_leaderboard: caller is not an admin';
  end if;
  -- WHERE matches every row (user_id is NOT NULL) but must be present:
  -- PostgREST sessions preload pg_safeupdate, which rejects unfiltered
  -- DELETEs even inside functions (same bug as sq_passed_on_leaderboard,
  -- fixed 2026-08-12).
  delete from public.sn_daily_feeds where user_id is not null;
end;
$$;

grant execute on function public.sn_admin_reset_leaderboard() to authenticated;
