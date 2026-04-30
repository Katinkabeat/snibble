-- Snibble — daily leaderboard RPC.
--
-- Returns score/words_fed/words_count/played_at for everyone who played
-- on the given date, sorted by score desc, played_at asc (first-submitted
-- wins ties). Returning words_fed lets the client expand a row to show
-- the player's full word list (gated client-side: only revealed once
-- the viewer has also submitted today).
--
-- SECURITY DEFINER bypasses the per-user "read own" RLS policy on
-- sn_daily_feeds. Only exposes leaderboard-relevant columns.

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
    user_id,
    score,
    words_fed,
    coalesce(array_length(words_fed, 1), 0) as words_count,
    played_at
  from public.sn_daily_feeds
  where feed_date = p_date
  order by score desc, played_at asc;
$$;

revoke all on function public.sn_daily_leaderboard(date) from public;
grant execute on function public.sn_daily_leaderboard(date) to authenticated;
