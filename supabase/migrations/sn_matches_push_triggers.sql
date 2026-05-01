-- Snibble — match push notification triggers.
--
-- Two triggers feed the snibble-push-notification Edge Function:
--   1. on_sn_match_opponent_joined : sn_matches AFTER UPDATE when
--      opponent_id flips from null to a user. Notifies the creator.
--   2. on_sn_match_round_submitted : sn_match_round_plays AFTER INSERT.
--      Notifies the OTHER player.
--
-- Both call the Edge Function via pg_net. Auth uses the project's
-- public anon JWT (the same key embedded in the frontend bundle —
-- the function only needs a valid JWT for verification, then it
-- creates its own service-role client internally).

create or replace function public.sn_notify_opponent_joined()
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
        'type', 'opponent_joined',
        'record', row_to_json(NEW)
      )
    );
  exception when others then
    raise warning 'Snibble opponent_joined push trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

drop trigger if exists on_sn_match_opponent_joined on public.sn_matches;
create trigger on_sn_match_opponent_joined
after update on public.sn_matches
for each row
when (OLD.opponent_id is null and NEW.opponent_id is not null)
execute function public.sn_notify_opponent_joined();

create or replace function public.sn_notify_round_submitted()
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
        'type', 'round_submitted',
        'record', row_to_json(NEW)
      )
    );
  exception when others then
    raise warning 'Snibble round_submitted push trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

drop trigger if exists on_sn_match_round_submitted on public.sn_match_round_plays;
create trigger on_sn_match_round_submitted
after insert on public.sn_match_round_plays
for each row
execute function public.sn_notify_round_submitted();
