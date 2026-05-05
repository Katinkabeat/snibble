-- Snibble — pending count function for the SQ hub inbox.
--
-- The hub's sq_pending_for(uid) RPC iterates games_catalog and calls
-- <game_id>_pending_for(uid) per game; missing functions are silently
-- skipped. Until this function existed, Snibble pendings never showed
-- in the hub bell, so users only saw notifications about new invites
-- via push (and only if push was enabled).
--
-- Returns one row per "kind" of pending:
--   - in_progress matches where I owe this round's play
--   - open matches where I'm the invitee (haven't accepted yet)

create or replace function public.snibble_pending_for(uid uuid)
returns table (count integer, label text, url text)
language sql
stable
as $$
  select count(*)::int, 'Your turn'::text, '/snibble/'::text
  from public.sn_matches m
  where m.status = 'in_progress'
    and (m.creator_id = uid or m.opponent_id = uid)
    and not exists (
      select 1 from public.sn_match_round_plays p
      where p.match_id = m.id and p.user_id = uid
    )
  having count(*) > 0
  union all
  select count(*)::int, 'Invite'::text, '/snibble/'::text
  from public.sn_matches m
  where m.status = 'open'
    and m.invited_user_id = uid
  having count(*) > 0;
$$;
