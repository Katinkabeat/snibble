-- ============================================================
-- Snibble — Extended solo leaderboards (card c92)
--
-- Adds:
--   sn_solo_leaderboard(p_timeframe, p_date)  — top 10 for window
--   sn_solo_my_rank(p_timeframe, p_date)      — caller's rank + score
--
-- Old sn_daily_leaderboard(date) is left alive so the live site keeps
-- working until the new client code deploys; drop in a follow-up.
--
-- Play-to-see gate is PRESERVED for today's day-tab view (caller must
-- be is_complete=true for today to see the day-tab leaderboard). Past
-- days and all aggregate windows are OPEN to everyone — including
-- callers who haven't played today. This matches the card c92 decision.
--
-- "Today" is computed server-side using Atlantic time so the server
-- stays the source of truth for which p_date is the live one.
-- ============================================================

-- ── 1. Solo leaderboard ──────────────────────────────────────
create or replace function public.sn_solo_leaderboard(
  p_timeframe text,
  p_date      date default current_date
)
returns table (
  user_id      uuid,
  score        int,
  words_fed    text[],   -- only populated for 'day' (per-day list)
  words_count  int,      -- single day for 'day'; SUM across window otherwise
  played_at    timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_start date;
  v_end   date;
  v_today date := (timezone('America/Halifax', now()))::date;
begin
  case p_timeframe
    when 'day'   then v_start := p_date;                            v_end := p_date + 1;
    when 'week'  then v_start := date_trunc('week',  p_date)::date; v_end := v_start + 7;
    when 'month' then v_start := date_trunc('month', p_date)::date; v_end := (v_start + interval '1 month')::date;
    when 'all'   then v_start := null;                              v_end := null;
    else raise exception 'Invalid p_timeframe: %', p_timeframe;
  end case;

  -- Play-to-see gate: only when viewing TODAY's day tab.
  if p_timeframe = 'day' and p_date = v_today then
    if not exists (
      select 1 from public.sn_daily_feeds caller
      where caller.user_id = auth.uid()
        and caller.feed_date = p_date
        and caller.is_complete = true
    ) then
      return;  -- caller hasn't submitted today; lock the day tab
    end if;
  end if;

  if p_timeframe = 'day' then
    return query
      select
        f.user_id,
        f.score,
        f.words_fed,
        coalesce(array_length(f.words_fed, 1), 0)::int as words_count,
        f.played_at
      from public.sn_daily_feeds f
      where f.feed_date = p_date
        and f.is_complete = true
      order by f.score desc, f.played_at asc
      limit 10;
  else
    return query
      select
        f.user_id,
        sum(f.score)::int                                       as score,
        null::text[]                                            as words_fed,
        sum(coalesce(array_length(f.words_fed, 1), 0))::int     as words_count,
        max(f.played_at)                                        as played_at
      from public.sn_daily_feeds f
      where f.is_complete = true
        and (v_start is null or f.feed_date >= v_start)
        and (v_end   is null or f.feed_date <  v_end)
      group by f.user_id
      order by sum(f.score) desc, max(f.played_at) asc
      limit 10;
  end if;
end;
$$;

revoke all on function public.sn_solo_leaderboard(text, date) from public;
grant execute on function public.sn_solo_leaderboard(text, date) to authenticated;

-- ── 2. My rank ───────────────────────────────────────────────
-- Always computes the caller's rank/score for the requested window;
-- the gate above only affects the leaderboard list. The client uses
-- the leaderboard's empty-result state to detect "locked".
create or replace function public.sn_solo_my_rank(
  p_timeframe text,
  p_date      date default current_date
)
returns table (rank int, score int)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_start date;
  v_end   date;
begin
  if v_uid is null then return; end if;

  case p_timeframe
    when 'day'   then v_start := p_date;                            v_end := p_date + 1;
    when 'week'  then v_start := date_trunc('week',  p_date)::date; v_end := v_start + 7;
    when 'month' then v_start := date_trunc('month', p_date)::date; v_end := (v_start + interval '1 month')::date;
    when 'all'   then v_start := null;                              v_end := null;
    else raise exception 'Invalid p_timeframe: %', p_timeframe;
  end case;

  if p_timeframe = 'day' then
    return query
      with ranked as (
        select
          f.user_id            as uid,
          f.score              as user_score,
          rank() over (order by f.score desc, f.played_at asc) as rk
        from public.sn_daily_feeds f
        where f.feed_date = p_date
          and f.is_complete = true
      )
      select rk::int, user_score::int
      from ranked
      where uid = v_uid;
  else
    return query
      with totals as (
        select
          f.user_id            as uid,
          sum(f.score)::int    as total_score,
          max(f.played_at)     as latest
        from public.sn_daily_feeds f
        where f.is_complete = true
          and (v_start is null or f.feed_date >= v_start)
          and (v_end   is null or f.feed_date <  v_end)
        group by f.user_id
      ),
      ranked as (
        select
          uid,
          total_score,
          rank() over (order by total_score desc, latest asc) as rk
        from totals
      )
      select rk::int, total_score::int
      from ranked
      where uid = v_uid;
  end if;
end;
$$;

revoke all on function public.sn_solo_my_rank(text, date) from public;
grant execute on function public.sn_solo_my_rank(text, date) to authenticated;
