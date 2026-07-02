-- Add a completion timestamp to the daily feed.
--
-- sn_daily_feeds is one MUTABLE row per (user_id, feed_date); played_at freezes
-- at the first feed of the day and never advances, so it can't drive a
-- "new since last poll" cursor. completed_at is set ONCE, when the feed is
-- finished (the player taps "Done" or hits 100% solutions), giving Rook's
-- #highlights "mouthful" trigger a real per-event timestamp to key off.
-- Nullable: rows written before this, and in-progress feeds, stay NULL.
alter table public.sn_daily_feeds
  add column if not exists completed_at timestamptz;
