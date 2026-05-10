-- ============================================================
-- Snibble — played_daily check function for the hub daily-reminder
-- registry. Returns true iff the user has a COMPLETED sn_daily_feeds
-- row for the given Atlantic-date ymd. Mid-play (is_complete=false)
-- still counts as not-yet-played so the daily ping fires.
-- ============================================================

create or replace function public.sn_played_daily(uid uuid, ymd date)
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

grant execute on function public.sn_played_daily(uuid, date)
  to authenticated, service_role;
