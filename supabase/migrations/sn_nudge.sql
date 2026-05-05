-- ============================================================
-- Snibble nudge — caller has submitted current round, nudges
-- the opponent who hasn't yet.
--
-- Mirrors Wordy/Rungles nudges in cooldown shape (12h between
-- nudges per match), adapted to Snibble's simultaneous-play
-- model: there's no current_player_idx, so the RPC walks the
-- rounds and finds the first round where the opponent has not
-- yet submitted. Caller must have submitted that round before
-- they're allowed to nudge ("I'm waiting for you" is the only
-- meaningful nudge here).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Track when the match was last nudged (cooldown anchor).
-- ─────────────────────────────────────────────────────────────
alter table public.sn_matches
  add column if not exists last_nudged_at timestamptz;


-- ─────────────────────────────────────────────────────────────
-- sn_nudge(match_id) — returns the nudged user's id so the
-- client can fire-and-forget POST to the edge function.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sn_nudge(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $sn_nudge$
declare
  v_user_id       uuid := auth.uid();
  v_match         public.sn_matches%rowtype;
  v_target        uuid;
  v_current_round int;
  v_cooldown      interval := interval '12 hours';
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_match
    from public.sn_matches
   where id = p_match_id
   for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status <> 'in_progress' then
    raise exception 'match not in progress';
  end if;

  -- Caller must be a participant.
  if v_user_id <> v_match.creator_id and v_user_id <> v_match.opponent_id then
    raise exception 'not a participant';
  end if;

  -- Target = the other player.
  v_target := case when v_user_id = v_match.creator_id
                   then v_match.opponent_id
                   else v_match.creator_id end;
  if v_target is null then
    raise exception 'no opponent yet';
  end if;

  -- Find the lowest-index round where the target hasn't submitted yet.
  -- That's the round we're nudging about.
  select r.round_index into v_current_round
    from public.sn_match_rounds r
   where r.match_id = p_match_id
     and not exists (
       select 1 from public.sn_match_round_plays p
        where p.match_id = r.match_id
          and p.round_index = r.round_index
          and p.user_id = v_target
     )
   order by r.round_index asc
   limit 1;

  if v_current_round is null then
    raise exception 'opponent has played all rounds';
  end if;

  -- Caller must have submitted this round first — otherwise it's
  -- not a "you're holding things up" nudge, it's a backseat poke.
  if not exists (
    select 1 from public.sn_match_round_plays
     where match_id    = p_match_id
       and round_index = v_current_round
       and user_id     = v_user_id
  ) then
    raise exception 'submit your round first before nudging';
  end if;

  -- Cooldowns: don't nudge fresh activity, don't double-nudge.
  if v_match.last_activity_at is not null
     and (now() - v_match.last_activity_at) < v_cooldown then
    raise exception 'turn too fresh to nudge';
  end if;
  if v_match.last_nudged_at is not null
     and (now() - v_match.last_nudged_at) < v_cooldown then
    raise exception 'already nudged recently';
  end if;

  update public.sn_matches
     set last_nudged_at = now()
   where id = p_match_id;

  return v_target;
end;
$sn_nudge$;

grant execute on function public.sn_nudge(uuid) to authenticated;
