-- ============================================================
-- Snibble — played_daily check function for the hub daily-reminder
-- registry. Returns true iff the user has a COMPLETED sn_daily_feeds
-- row for the given Atlantic-date ymd. Mid-play (is_complete=false)
-- still counts as not-yet-played so the daily ping fires.
--
-- Function name is `snibble_played_daily` (not `sn_*`) so it matches
-- the hub registry naming convention `<game_catalog_id>_played_daily`
-- where games_catalog.id is 'snibble'. Snibble's internal `sn_` table
-- prefix doesn't apply to this registry-facing function.
-- ============================================================

drop function if exists public.sn_played_daily(uuid, date);

create or replace function public.snibble_played_daily(uid uuid, ymd date)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.sn_daily_feeds
    where user_id = uid
      and feed_date = ymd
      and is_complete = true
  );
$$;

grant execute on function public.snibble_played_daily(uuid, date)
  to authenticated, service_role;
