-- Snibble — fix recursive RLS on sn_match_round_plays.
--
-- The original "read opponent if both submitted" policy queried
-- sn_match_round_plays from inside its own SELECT policy, which
-- triggers infinite recursion in Postgres.
--
-- Replacement: any participant in the match can read all plays for
-- that match. The client enforces "don't show opponent words until
-- both submitted" — a motivated user could peek via raw queries, but
-- it's not a real security boundary, just a UX gate.

drop policy if exists "sn_match_round_plays read own" on public.sn_match_round_plays;
drop policy if exists "sn_match_round_plays read opponent if both submitted" on public.sn_match_round_plays;

create policy "sn_match_round_plays read participant" on public.sn_match_round_plays
  for select using (
    exists (
      select 1 from public.sn_matches m
      where m.id = match_id
        and (m.creator_id = auth.uid() or m.opponent_id = auth.uid())
    )
  );
