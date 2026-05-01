-- Snibble — let admins delete any match.
--
-- Admin status lives in the shared `public.admins` table (used by
-- Wordy/Rungles/Snibble alike). Admins can DELETE any sn_matches
-- row; FK cascades clear sn_match_rounds and sn_match_round_plays.
--
-- Used by the admin "Cancel" button on lobby match rows so we can
-- clear stale or test matches without dropping into psql.

create policy "sn_matches admin delete" on public.sn_matches
  for delete using (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
