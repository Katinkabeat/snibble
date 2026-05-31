-- Snibble — notify creator when a decline closes their match (Phase 2)
-- CREATE OR REPLACE of sn_decline_invite (from sn_matches_decline_invite.sql)
-- to also fire an 'invite_declined' push to the creator. Snibble invites are
-- 1v1, so a decline always closes the match → always notify. Gated per
-- recipient in the edge fn via sq_notification_enabled('snibble',
-- 'invite_declined') — default OFF. Idempotent.

create or replace function public.sn_decline_invite(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_invited uuid;
  v_status  text;
  v_creator uuid;
  v_uid     uuid := auth.uid();
begin
  select invited_user_id, status, creator_id into v_invited, v_status, v_creator
  from public.sn_matches where id = p_match_id for update;

  if not found then
    raise exception 'Match not found';
  end if;
  if v_status <> 'open' then
    raise exception 'Match has already started or closed';
  end if;
  if v_invited is null or v_invited <> v_uid then
    raise exception 'You were not invited to this match';
  end if;

  update public.sn_matches
  set status = 'cancelled',
      cancelled_at = now(),
      close_reason = 'Invite declined',
      last_activity_at = now()
  where id = p_match_id;

  begin
    perform net.http_post(
      url := 'https://yyhewndblruwxsrqzart.supabase.co/functions/v1/snibble-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5aGV3bmRibHJ1d3hzcnF6YXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDk4MjAsImV4cCI6MjA4OTA4NTgyMH0.vwL4iipf5e_bm8rsW_dECSv640s8Kds5c2tYCOJqEnQ'
      ),
      body := jsonb_build_object(
        'type', 'invite_declined',
        'match_id', p_match_id,
        'creator_id', v_creator,
        'decliner_id', v_uid
      )
    );
  exception when others then
    raise warning 'Snibble invite_declined push failed: %', SQLERRM;
  end;
end;
$$;

revoke all on function public.sn_decline_invite(uuid) from public;
grant execute on function public.sn_decline_invite(uuid) to authenticated;
