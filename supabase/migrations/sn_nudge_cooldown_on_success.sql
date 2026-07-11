-- c264 (c248/c260/c261 follow-up): only start the 12h nudge cooldown once the
-- push actually delivers. sn_nudge previously stamped last_nudged_at up-front
-- (validate + stamp in one RPC), so a failed push — dead subscription, timeout,
-- or a 200 { sent:false } for an unsubscribed recipient — burned the cooldown
-- and the nudger's retry then hit "already nudged recently" instead of a real
-- retry. Split into: sn_nudge (validate + return target, no stamp) +
-- sn_mark_nudged (stamp), and the client stamps ONLY after postNudge reports
-- delivered:true. Mirrors Yahdle's yahdle_nudge / yahdle_mark_nudged split.
--
-- Re-specify SET search_path: CREATE OR REPLACE clears the SET clause that
-- secdef_hardening.sql applied, so it must be restated or the SECDEF hardening
-- silently regresses. Execute grants persist across CREATE OR REPLACE.

-- sn_nudge: validate eligibility + cooldown and RETURN the target uuid (the
-- client forwards it as target_user_id in the push body). NO LONGER stamps.
create or replace function public.sn_nudge(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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

  -- Read-only now (validate does not write), so no FOR UPDATE — mirrors Yahdle.
  select * into v_match
    from public.sn_matches
   where id = p_match_id;
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

  -- c264: stamp moved to sn_mark_nudged, called only after the push lands.
  return v_target;
end;
$sn_nudge$;

-- sn_mark_nudged: stamp the 12h cooldown. Called by the client ONLY after the
-- nudge push has been delivered. Re-checks participation in an in-progress
-- match so it can't be used to stamp a cooldown out of context.
create or replace function public.sn_mark_nudged(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $sn_mark_nudged$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.sn_matches m
     where m.id = p_match_id
       and m.status = 'in_progress'
       and (m.creator_id = v_user_id or m.opponent_id = v_user_id)
  ) then
    raise exception 'not eligible to mark nudged';
  end if;
  update public.sn_matches set last_nudged_at = now() where id = p_match_id;
end;
$sn_mark_nudged$;

-- Match the hardened ACL sn_nudge already carries (anon/public revoked).
revoke execute on function public.sn_nudge(uuid)       from anon, public;
revoke execute on function public.sn_mark_nudged(uuid) from anon, public;
grant  execute on function public.sn_nudge(uuid)       to authenticated;
grant  execute on function public.sn_mark_nudged(uuid) to authenticated;
