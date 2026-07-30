-- ============================================================
-- Snibble — leaderboard tie-break: order on FINISH, not START.
--
-- Bug (found 2026-07-30): Rae and Dean both scored 80 on the daily.
-- Dean finished 63 seconds ahead of her, but Rae took first place.
--
--   Rae   played_at 03:12:23Z   completed_at 12:23:33Z
--   Dino  played_at 12:08:08Z   completed_at 12:22:30Z
--
-- Cause: sn_daily_feeds is ONE MUTABLE ROW per (user_id, feed_date),
-- and played_at is frozen at the row's first feed of the day — see
-- sn_daily_feeds_write_guard.sql ("played_at is left frozen at the
-- first feed"). So `order by played_at asc` is first-to-START, not
-- first-to-SUBMIT. Rae opened the daily at 12:12am Atlantic and
-- finished in the morning; her 11-hour-old start timestamp outranked
-- Dean's earlier finish.
--
-- The old comment on these functions claimed "first-submitted wins
-- ties", which is why this went unnoticed for months.
--
-- Fix: tie-break on coalesce(completed_at, played_at).
--   * completed_at is set ONCE when the feed is finished (the player
--     taps Done or hits 100%) — sn_daily_feeds_completed_at.sql.
--   * It is nullable: rows written before that column existed, and
--     in-progress feeds, are NULL. The coalesce keeps those rows
--     ordering exactly as they do today rather than sorting as NULL.
--   * in-progress rows never reach these queries anyway
--     (is_complete = true filter), so the fallback only ever applies
--     to pre-completed_at history.
--
-- The returned `played_at` column is deliberately UNCHANGED — it is
-- part of the function signature and the client does not read it
-- (no reference to played_at anywhere in snibble/src). Only the
-- ordering changes.
--
-- Applying this flips today's board: Dean takes first.
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
      -- tie-break on finish time, not start time
      order by f.score desc, coalesce(f.completed_at, f.played_at) asc
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
      -- across a window, the tie-break is who last FINISHED a daily
      order by sum(f.score) desc, max(coalesce(f.completed_at, f.played_at)) asc
      limit 10;
  end if;
end;
$$;

revoke all on function public.sn_solo_leaderboard(text, date) from public;
grant execute on function public.sn_solo_leaderboard(text, date) to authenticated;

-- ── 2. My rank ───────────────────────────────────────────────
-- Must use the IDENTICAL tie-break to sn_solo_leaderboard above, or a
-- player's "you are #N" badge disagrees with the list they're looking at.
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
          rank() over (order by f.score desc, coalesce(f.completed_at, f.played_at) asc) as rk
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
          f.user_id                                     as uid,
          sum(f.score)::int                             as total_score,
          max(coalesce(f.completed_at, f.played_at))    as latest
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
