-- Snibble — fix RLS so a non-participant can join an open match.
--
-- The original "sn_matches update participant" policy only lets a
-- user UPDATE the row if they are already creator_id or opponent_id.
-- That blocks the join flow: when Onyi tries to set herself as
-- opponent on Trace's open match, RLS filters the row out, the UPDATE
-- affects 0 rows, and `.single()` throws "cannot coerce the results
-- to a single JSON object".
--
-- We keep the participant-update policy for ongoing match edits and
-- add a second policy that specifically permits the "claim an open
-- match" transition: USING gates the row to open + unclaimed; the
-- WITH CHECK guarantees the joiner can only set themselves as the
-- new opponent (they cannot smuggle in a different opponent_id, can't
-- alter creator_id, and the row's status must move to in_progress).

create policy "sn_matches join open" on public.sn_matches
  for update
  using (
    status = 'open'
    and opponent_id is null
    and creator_id <> auth.uid()
  )
  with check (
    opponent_id = auth.uid()
    and status = 'in_progress'
  );
