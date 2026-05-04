-- Snibble — shorten invite expiry from 3d to 1d (2026-05-03).
--
-- Open matches stay at 7d (cleanup hygiene only). Invited matches
-- now auto-cancel after 24h to keep the friend-invite loop fast.

create or replace function public.sn_set_match_expiry()
returns trigger language plpgsql as $$
begin
  if NEW.expires_at is null then
    if NEW.invited_user_id is not null then
      NEW.expires_at := NEW.created_at + interval '1 day';
    else
      NEW.expires_at := NEW.created_at + interval '7 days';
    end if;
  end if;
  return NEW;
end;
$$;
