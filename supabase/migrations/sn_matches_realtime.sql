-- Snibble — enable Supabase Realtime on match tables.
--
-- Without this, postgres_changes subscriptions on sn_matches /
-- sn_match_round_plays silently no-op: the channel subscribes fine
-- but no events are ever delivered. The lobby and MatchView both
-- subscribe to these tables to live-update when an invite arrives,
-- an opponent joins, or the opponent submits a round — without this
-- migration, the user only sees changes after a manual refresh.
--
-- Wordy and Rungles already have their equivalent tables published.
-- This brings Snibble to parity.

alter publication supabase_realtime add table public.sn_matches;
alter publication supabase_realtime add table public.sn_match_round_plays;
