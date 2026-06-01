-- ============================================================
-- SNIBBLE — invite-expiry baseline (card c151)
--
-- Brings Snibble onto the SQ invite-expiry baseline (Yahdle c150 /
-- sq-game-starter c152). Snibble is 1v1, so the only expiry case is
-- "the opponent never joined":
--   • Friend-invite window 1 day → 3 days (open matches stay 7 days).
--   • At expiry, keep the status='expired' flip (the lobby's Completed
--     bucket already surfaces 'expired' matches), but also stamp
--     close_reason='no_other_players' and fire one 'game_closed' push to
--     the creator. The client renders an "invite expired" headline for
--     these instead of a generic tie/score line.
--
-- Reuses the existing close_reason column (sn_matches_admin_close_reason).
-- Setting an 'open' match to 'expired' fires no triggers (the only AFTER
-- UPDATE trigger fires on opponent_id null→not-null), and no finalize is
-- called, so no stats are written. Idempotent.
-- ============================================================

-- ── 1. Expiry window: friend invites 1 day → 3 days ──────────
create or replace function public.sn_set_match_expiry()
returns trigger language plpgsql as $$
begin
  if NEW.expires_at is null then
    if NEW.invited_user_id is not null then
      NEW.expires_at := NEW.created_at + interval '3 days';
    else
      NEW.expires_at := NEW.created_at + interval '7 days';
    end if;
  end if;
  return NEW;
end;
$$;

-- ── 2. Expire sweep: close-with-reason + push (was a silent flip) ─
create or replace function public.sn_expire_stale_matches()
returns int language plpgsql security definer
set search_path = public
as $$
declare
  m       record;
  v_count int := 0;
begin
  for m in
    select id, creator_id from public.sn_matches
     where status = 'open'
       and expires_at is not null
       and expires_at < now()
     for update
  loop
    update public.sn_matches
       set status = 'expired',
           close_reason = 'no_other_players',
           last_activity_at = now()
     where id = m.id;

    -- One push to the creator (the only notification in this flow).
    begin
      perform net.http_post(
        url := 'https://yyhewndblruwxsrqzart.supabase.co/functions/v1/snibble-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5aGV3bmRibHJ1d3hzcnF6YXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDk4MjAsImV4cCI6MjA4OTA4NTgyMH0.vwL4iipf5e_bm8rsW_dECSv640s8Kds5c2tYCOJqEnQ'
        ),
        body := jsonb_build_object(
          'type', 'game_closed',
          'record', jsonb_build_object(
            'id', m.id,
            'creator_id', m.creator_id,
            'close_reason', 'no_other_players'
          )
        )
      );
    exception when others then
      raise warning 'Snibble game_closed push failed: %', SQLERRM;
    end;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.sn_expire_stale_matches() to authenticated;
