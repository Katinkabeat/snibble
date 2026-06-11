-- Snibble — game-end push for claim / forfeit (c188).
--
-- GAP: claim & forfeit are client-side sn_matches UPDATEs (status →
-- 'completed') with no round-play insert, so the existing round_submitted
-- trigger never fires and the loser/surprise-winner got no push.
--
-- UNIFIED SQ CONTRACT: an end_reason marker on the match + an AFTER UPDATE
-- trigger that fires ONLY when end_reason is set. Normal last-round
-- completion leaves end_reason NULL (still covered by round_submitted's
-- "match complete!"), so there's no double push. Admin-close also stays
-- silent (it doesn't set end_reason).

-- ── 1. End-reason marker ──────────────────────────────────────
ALTER TABLE public.sn_matches
  ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- ── 2. Game-end push trigger ──────────────────────────────────
create or replace function public.sn_notify_match_ended()
returns trigger language plpgsql security definer as $$
begin
  begin
    perform net.http_post(
      url := 'https://yyhewndblruwxsrqzart.supabase.co/functions/v1/snibble-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5aGV3bmRibHJ1d3hzcnF6YXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDk4MjAsImV4cCI6MjA4OTA4NTgyMH0.vwL4iipf5e_bm8rsW_dECSv640s8Kds5c2tYCOJqEnQ'
      ),
      body := jsonb_build_object(
        'type', 'game_finished',
        'record', row_to_json(NEW)
      )
    );
  exception when others then
    raise warning 'Snibble match-ended push trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

drop trigger if exists on_sn_match_ended on public.sn_matches;
create trigger on_sn_match_ended
after update on public.sn_matches
for each row
when (OLD.status = 'in_progress' and NEW.status = 'completed' and NEW.end_reason is not null)
execute function public.sn_notify_match_ended();
