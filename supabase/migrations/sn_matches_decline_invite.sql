-- Snibble — decline a friend invite (2026-05-31)
-- Lets an invited player decline an 'open' match they were invited to.
-- Snibble invites are strictly 1v1 (single invited_user_id), so a
-- decline always closes the match.
--
-- Behavior (per SQ decline decision, card c167):
--   • Caller must be the invited_user_id of an 'open' match.
--   • The match is closed: status='cancelled', close_reason='Invite declined'.
--   • We don't silently strand the invite and we don't convert a private
--     friend invite into a public open match.
--
-- Notifying the creator on decline is Phase 2 (per-game opt-in), not here.
-- Idempotent. Run in Supabase SQL editor.

create or replace function public.sn_decline_invite(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_invited uuid;
  v_status  text;
begin
  select invited_user_id, status into v_invited, v_status
  from public.sn_matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;
  if v_status <> 'open' then
    raise exception 'Match has already started or closed';
  end if;
  if v_invited is null or v_invited <> auth.uid() then
    raise exception 'You were not invited to this match';
  end if;

  update public.sn_matches
  set status = 'cancelled',
      cancelled_at = now(),
      close_reason = 'Invite declined',
      last_activity_at = now()
  where id = p_match_id;
end;
$$;

revoke all on function public.sn_decline_invite(uuid) from public;
grant execute on function public.sn_decline_invite(uuid) to authenticated;
