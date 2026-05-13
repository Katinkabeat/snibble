-- Snibble — daily leaderboard RPC.
--
-- Returns score/words_fed/words_count/played_at for everyone who has
-- SUBMITTED on the given date, sorted by score desc, played_at asc
-- (first-submitted wins ties). Returning words_fed lets the client
-- expand a row to show the player's full word list.
--
-- Privacy rules enforced server-side (2026-05-13):
--   1. Only rows with is_complete = true are returned. In-progress
--      players are absent from the leaderboard until they tap Done.
--   2. The caller must themselves be is_complete = true for p_date,
--      otherwise the function returns zero rows. This prevents anyone
--      from peeking at submitted players' words before submitting.
--
-- SECURITY DEFINER bypasses the per-user "read own" RLS policy on
-- sn_daily_feeds. Only exposes leaderboard-relevant columns, and
-- only after both privacy checks above pass.

drop function if exists public.sn_daily_leaderboard(date);

create or replace function public.sn_daily_leaderboard(p_date date)
returns table (
  user_id      uuid,
  score        int,
  words_fed    text[],
  words_count  int,
  played_at    timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    f.user_id,
    f.score,
    f.words_fed,
    coalesce(array_length(f.words_fed, 1), 0) as words_count,
    f.played_at
  from public.sn_daily_feeds f
  where f.feed_date = p_date
    and f.is_complete = true
    and exists (
      select 1
      from public.sn_daily_feeds caller
      where caller.user_id = auth.uid()
        and caller.feed_date = p_date
        and caller.is_complete = true
    )
  order by f.score desc, f.played_at asc;
$$;

revoke all on function public.sn_daily_leaderboard(date) from public;
grant execute on function public.sn_daily_leaderboard(date) to authenticated;
