-- Atomic Snibble match-round submission.
--
-- WHY: submitMatchRound (matchActions.js) committed a round as a
-- non-atomic sequence of separate client writes — INSERT into
-- sn_match_round_plays, then a separate UPDATE to sn_matches
-- (last_activity_at), then a completion UPDATE (status / winner_id). If
-- the insert landed but a follow-up update failed (network drop, etc.),
-- the match could stick: the round is recorded but the match is never
-- marked completed. Same class as the Wordy half-commit bug.
--
-- This SECURITY DEFINER RPC does the whole submission in one transaction.
-- It locks the match row, so two players racing their final submission
-- can't both compute a winner and clobber each other. Running as definer
-- also lets the completion check see BOTH players' plays reliably (the
-- read RLS hides the opponent's rows until both submit a round).
--
-- The play insert relies on the existing PK (match_id, round_index,
-- user_id): a resubmission of the same round fails the insert, so a
-- retry-after-success rejects cleanly with a friendly message rather
-- than double-applying.
--
-- Run order: after sn_matches_schema.sql, sn_matches_invite_friend.sql,
-- sn_matches_fix_rls.sql.

create or replace function public.sn_submit_match_round(
  p_match_id    uuid,
  p_round_index int,
  p_words_fed   text[],
  p_score       int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $sn_submit_match_round$
declare
  v_user_id        uuid := auth.uid();
  v_match          public.sn_matches%rowtype;
  v_total_rounds   int;
  v_creator_rounds int;
  v_opp_rounds     int := 0;
  v_creator_total  int;
  v_opp_total      int := 0;
  v_both_done      boolean := false;
  v_winner         uuid := null;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the match so concurrent final submissions serialize.
  select * into v_match from public.sn_matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found';
  end if;
  if v_match.status not in ('open', 'in_progress') then
    raise exception 'Match is not active';
  end if;

  -- Record the play. The PK blocks a duplicate (same user + round).
  insert into public.sn_match_round_plays (match_id, round_index, user_id, words_fed, score)
  values (p_match_id, p_round_index, v_user_id, p_words_fed, p_score);

  -- Has everyone submitted every round that exists for this match?
  select count(*) into v_total_rounds
    from public.sn_match_rounds where match_id = p_match_id;

  select count(distinct round_index), coalesce(sum(score), 0)
    into v_creator_rounds, v_creator_total
    from public.sn_match_round_plays
   where match_id = p_match_id and user_id = v_match.creator_id;

  if v_match.opponent_id is not null then
    select count(distinct round_index), coalesce(sum(score), 0)
      into v_opp_rounds, v_opp_total
      from public.sn_match_round_plays
     where match_id = p_match_id and user_id = v_match.opponent_id;
  end if;

  v_both_done := v_match.opponent_id is not null
                 and v_creator_rounds = v_total_rounds
                 and v_opp_rounds = v_total_rounds;

  if v_both_done then
    -- Higher total wins; equal totals = tie (winner stays null).
    if v_creator_total > v_opp_total then
      v_winner := v_match.creator_id;
    elsif v_opp_total > v_creator_total then
      v_winner := v_match.opponent_id;
    end if;

    update public.sn_matches
       set status = 'completed',
           completed_at = now(),
           winner_id = v_winner,
           last_activity_at = now()
     where id = p_match_id;
  else
    update public.sn_matches set last_activity_at = now() where id = p_match_id;
  end if;

  return jsonb_build_object('complete', v_both_done, 'score', p_score, 'winner_id', v_winner);
exception
  when unique_violation then
    raise exception 'You already submitted this round.';
end;
$sn_submit_match_round$;

revoke all on function public.sn_submit_match_round(uuid, int, text[], int) from public;
grant execute on function public.sn_submit_match_round(uuid, int, text[], int) to authenticated;
