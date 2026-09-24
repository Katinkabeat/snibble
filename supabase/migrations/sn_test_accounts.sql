-- ============================================================
-- Snibble — Test Accounts group (card c332)
--
-- Members of the shared "test-accounts" group (public.sq_is_test_account /
-- public.sq_test_account_ids, already live) get three carve-outs here:
--
--   1. Solo leaderboard/rank never surface a member's result. Excluded
--      inside sn_solo_leaderboard's day/window branches and
--      sn_solo_my_rank's day/window branches (both authoritative as of
--      sn_leaderboard_tiebreak_completed_at.sql), so a member never
--      occupies a rank slot. The play-to-see gate (must have completed
--      TODAY's daily to view today's tab) is untouched — a member who
--      played today can still see the board, they just never appear on
--      it.
--
--   2. Multiplayer win/loss/tie/rounds stats: handled entirely
--      client-side in useMyStats.js — any completed sn_matches row with
--      a member seated (creator OR opponent) is dropped from BOTH
--      players' aggregates. There's no server-side multiplayer stats RPC
--      in Snibble to patch. Lifetime word-fed totals are NOT filtered —
--      that's a personal tally, not a competitive stat, and the rule
--      only calls out win/loss/tie/rounds.
--
--   3. Daily replay: a member can replay today's daily as often as they
--      like; each finished replay overwrites the day's row.
--      sn_record_daily_feed's existing ON CONFLICT DO UPDATE already
--      overwrites words/score/is_complete on every call — the only thing
--      standing between a member and a fresh play is the client's
--      "already done today" gate, which reads is_complete off the
--      existing row. So the simplest correct fix is: delete the row and
--      let the normal path re-insert it fresh, rather than adding a
--      second write mode to the finish RPC. sn_test_reset_today() does
--      that deletion, but ONLY for a caller who is a test-account
--      member — re-checked server-side on every call, never trusting the
--      client's own membership cache; a non-member gets a raised
--      exception. The pre-existing "sn_daily_feeds delete own" RLS
--      policy (sn_app_settings.sql, meant to be gated in the UI by the
--      currently-unwired redo_today_enabled admin flag — no client code
--      reads that flag today) is untouched; this is a separate,
--      always-on, membership-gated path used only by the replay button.
-- ============================================================

-- ── 1. Solo leaderboard — exclude members ─────────────────────
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

  -- Play-to-see gate: only when viewing TODAY's day tab. Unchanged by
  -- c332 — a member who played today still unlocks the view, they just
  -- never appear in the rows below.
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
        and not public.sq_is_test_account(f.user_id)  -- c332
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
        and not public.sq_is_test_account(f.user_id)  -- c332
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

-- ── 2. My rank — same exclusion, identical tie-break ──────────
-- Must stay identical to sn_solo_leaderboard's ordering/filter, or a
-- player's "you are #N" badge disagrees with the list they're looking
-- at. A member calling this for themself now gets an empty result
-- (their row is excluded from the ranked CTE, so `uid = v_uid` matches
-- nothing) — there's no rank to report, matching the board they see.
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
          and not public.sq_is_test_account(f.user_id)  -- c332
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
          and not public.sq_is_test_account(f.user_id)  -- c332
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

-- ── 3. Test-account daily reset ───────────────────────────────
-- Deletes the caller's OWN sn_daily_feeds row for the current Atlantic
-- day, but ONLY if they're a test-account member — checked server-side
-- on every call, never trusting the client's cached membership flag.
-- Backs the "Replay (test account)" button on the already-played
-- screen; the client then resets its local session and replays through
-- the normal sn_record_daily_feed path, which inserts a fresh row (and
-- so overwrites the day's result, per rule 3).
create or replace function public.sn_test_reset_today()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (timezone('America/Halifax', now()))::date;
begin
  if v_uid is null then
    raise exception 'sn_test_reset_today: not authenticated';
  end if;

  if not public.sq_is_test_account(v_uid) then
    raise exception 'sn_test_reset_today: caller is not a test account';
  end if;

  delete from public.sn_daily_feeds
  where user_id = v_uid
    and feed_date = v_today;
end;
$$;

revoke all on function public.sn_test_reset_today() from public;
grant execute on function public.sn_test_reset_today() to authenticated;
