-- ============================================================
-- Snibble — server-side write guard for daily feeds (c237)
--
-- Closes the "midnight daily-reveal" loophole. Background:
--   * Past-day leaderboards deliberately ungate at local midnight
--     (the c92 decision) — anyone can read yesterday's full word
--     lists once the day rolls over. That read behaviour is wanted.
--   * The hole was on the WRITE side: sn_daily_feeds was written by a
--     direct client upsert guarded only by a "write your own rows" RLS
--     policy — with NO check that feed_date is actually today. So a
--     player who left yesterday's puzzle open past midnight could read
--     the now-revealed board, feed the copied words into their still-
--     open session, and submit a padded score onto yesterday's board.
--
-- Fix (direction A, Rae 2026-06-29): make past days immutable on the
-- write side. All writes now go through SECURITY DEFINER RPCs that
-- compute the Atlantic date server-side; the direct insert/update RLS
-- policies are dropped so the table can't be written any other way.
-- Mirrors the sn_daily_puzzles pattern (RPC is the only writer).
--
-- Two writers, deliberately split so the honest late finisher is
-- protected without opening a padding vector:
--   1. sn_record_daily_feed  — adds/updates words+score. STRICT: only
--      today may be written. This is the padding-blocker.
--   2. sn_finalize_daily_feed — flips is_complete on an EXISTING row
--      only (never touches words/score). Allowed for today OR
--      yesterday, so a session that crosses midnight can still lock in
--      the words it already fed onto the day it started. Because it
--      can't add words, it gives an exploiter nothing to pad with.
-- ============================================================

-- ── 1. record a feed (add/update words + score) — TODAY ONLY ──
-- auth.uid() is the only user identity used; the client can't write
-- another user's row. On conflict, words/score/is_complete are
-- overwritten with the caller's current session; played_at is left
-- frozen at the first feed; completed_at is set once and never rolled
-- back.
create or replace function public.sn_record_daily_feed(
  p_feed_date   date,
  p_pet_id      text,
  p_words_fed   text[],
  p_score       int,
  p_is_complete boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/Halifax', now()))::date;
  v_uid   uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sn_record_daily_feed: not authenticated';
  end if;

  -- The guard. Feeds may only be recorded for the current Atlantic day.
  -- Past days are immutable (no after-the-fact padding); future days
  -- can't be pre-seeded either.
  if p_feed_date <> v_today then
    raise exception 'sn_record_daily_feed: feed_date % is not today (%); past/future writes are not allowed', p_feed_date, v_today;
  end if;

  insert into public.sn_daily_feeds
    (user_id, feed_date, pet_id, words_fed, score, is_complete, completed_at, phases_done)
  values
    (v_uid, p_feed_date, p_pet_id,
     coalesce(p_words_fed, '{}'), coalesce(p_score, 0), coalesce(p_is_complete, false),
     case when coalesce(p_is_complete, false) then now() else null end, 0)
  on conflict (user_id, feed_date) do update set
    pet_id       = excluded.pet_id,
    words_fed    = excluded.words_fed,
    score        = excluded.score,
    is_complete  = excluded.is_complete,
    completed_at = case
                     when excluded.is_complete
                       then coalesce(public.sn_daily_feeds.completed_at, now())
                     else public.sn_daily_feeds.completed_at
                   end;
end;
$$;

revoke all on function public.sn_record_daily_feed(date, text, text[], int, boolean) from public;
grant execute on function public.sn_record_daily_feed(date, text, text[], int, boolean) to authenticated;

-- ── 2. finalize a session (flip is_complete) — TODAY or YESTERDAY ──
-- Only ever sets is_complete/completed_at on a row that already exists
-- and isn't complete yet. It cannot add words or change the score, so
-- it can't be used to pad a past board — it just locks in whatever the
-- honest player already fed before midnight. The one-day grace covers a
-- session that was started before local midnight and finished (or was
-- auto-submitted) just after it.
create or replace function public.sn_finalize_daily_feed(
  p_feed_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/Halifax', now()))::date;
  v_uid   uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sn_finalize_daily_feed: not authenticated';
  end if;

  if p_feed_date <> v_today and p_feed_date <> v_today - 1 then
    raise exception 'sn_finalize_daily_feed: feed_date % is outside the today/yesterday grace (today=%)', p_feed_date, v_today;
  end if;

  update public.sn_daily_feeds
     set is_complete  = true,
         completed_at = coalesce(completed_at, now())
   where user_id     = v_uid
     and feed_date   = p_feed_date
     and is_complete = false;
end;
$$;

revoke all on function public.sn_finalize_daily_feed(date) from public;
grant execute on function public.sn_finalize_daily_feed(date) to authenticated;

-- ── 3. lock the table down to the RPCs above ──────────────────
-- Drop the direct insert/update policies so PostgREST can no longer
-- write sn_daily_feeds outside the guarded functions. Reads stay
-- per-user (read own); delete-own stays (used by the admin "redo
-- today" reset — a self-delete can't pad a board, and any re-insert
-- still has to pass the today-only guard above).
drop policy if exists "sn_daily_feeds write own"  on public.sn_daily_feeds;
drop policy if exists "sn_daily_feeds update own" on public.sn_daily_feeds;
