-- Snibble — per-player dismissal of completed match banners.
--
-- The lobby shows a persistent "result banner" for every recently
-- completed match (mirrors the wordy/rungles UX). Each player can
-- dismiss their own banner without affecting the other player. Two
-- nullable timestamps on sn_matches keep this 1v1 logic simple — no
-- separate dismissal table needed.
--
-- Banners appear when the viewer's column is null and disappear once
-- it's set. The existing "sn_matches update participant" RLS policy
-- already lets a player update either column, so a server-side
-- guard isn't strictly necessary, but we still scope writes to the
-- correct column via the matchActions helper to keep intent clear.

alter table public.sn_matches
  add column if not exists creator_dismissed_at  timestamptz,
  add column if not exists opponent_dismissed_at timestamptz;
