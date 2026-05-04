-- Snibble — invite-a-friend feature (2026-05-03).
--
-- Three new columns on sn_matches:
--   invited_user_id : if set, only this user can see + join the match
--   expires_at      : auto-cancel deadline (3d for invited, 7d for open)
--   cancelled_at    : set when creator manually cancels (only if no plays)
--
-- 'cancelled' added to status check constraint.
-- Read-RLS replaced to hide invited matches from non-participants.
-- New RPCs:
--   sn_cancel_match(p_match_id)   — creator-only, blocked once plays exist
--   sn_expire_stale_matches()     — sweeps past-expiry open matches to 'expired'

-- ─────────────────────────────────────────────────────────────────────
-- Columns + index
-- ─────────────────────────────────────────────────────────────────────
alter table public.sn_matches
  add column if not exists invited_user_id uuid references auth.users(id) on delete set null,
  add column if not exists expires_at      timestamptz,
  add column if not exists cancelled_at    timestamptz;

create index if not exists sn_matches_invited_idx on public.sn_matches(invited_user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Status check constraint — add 'cancelled'
-- ─────────────────────────────────────────────────────────────────────
alter table public.sn_matches drop constraint if exists sn_matches_status_check;
alter table public.sn_matches add constraint sn_matches_status_check
  check (status in ('open','in_progress','completed','expired','cancelled'));

-- ─────────────────────────────────────────────────────────────────────
-- Auto-set expires_at on insert (3d invited, 7d open).
-- Caller can override by passing an explicit expires_at; the trigger
-- only fills nulls.
-- ─────────────────────────────────────────────────────────────────────
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

drop trigger if exists on_sn_match_set_expiry on public.sn_matches;
create trigger on_sn_match_set_expiry
before insert on public.sn_matches
for each row
execute function public.sn_set_match_expiry();

-- ─────────────────────────────────────────────────────────────────────
-- Read-RLS: hide invited matches from non-participants
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists "sn_matches read all" on public.sn_matches;

create policy "sn_matches read visible" on public.sn_matches
  for select using (
    auth.role() = 'authenticated' and (
      invited_user_id is null
      or auth.uid() = creator_id
      or auth.uid() = invited_user_id
      or auth.uid() = opponent_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- sn_cancel_match — creator-only, blocked once plays exist
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sn_cancel_match(p_match_id uuid)
returns void language plpgsql security definer
set search_path = public
as $$
declare
  v_creator uuid;
  v_status  text;
  v_plays   int;
begin
  select creator_id, status into v_creator, v_status
  from public.sn_matches where id = p_match_id;

  if v_creator is null then
    raise exception 'Match not found';
  end if;

  if v_creator <> auth.uid() then
    raise exception 'Only the creator can cancel this match';
  end if;

  if v_status not in ('open','in_progress') then
    raise exception 'Match is not active';
  end if;

  select count(*) into v_plays
  from public.sn_match_round_plays
  where match_id = p_match_id;

  if v_plays > 0 then
    raise exception 'Cannot cancel after a player has fed words';
  end if;

  update public.sn_matches
  set status = 'cancelled',
      cancelled_at = now(),
      last_activity_at = now()
  where id = p_match_id;
end;
$$;

revoke all on function public.sn_cancel_match(uuid) from public;
grant execute on function public.sn_cancel_match(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- sn_expire_stale_matches — sweeps past-expiry open matches to 'expired'.
-- Authed users can call. Lobby loads call it lazily; future cron can
-- run it on a schedule.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sn_expire_stale_matches()
returns int language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with updated as (
    update public.sn_matches
    set status = 'expired', last_activity_at = now()
    where status = 'open'
      and expires_at is not null
      and expires_at < now()
    returning 1
  )
  select count(*) into v_count from updated;
  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.sn_expire_stale_matches() from public;
grant execute on function public.sn_expire_stale_matches() to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Push notification trigger when a match is created with an invitee.
-- Body type 'match_invited' — the snibble-push-notification edge
-- function handles the message construction.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sn_notify_match_invited()
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
        'type', 'match_invited',
        'record', row_to_json(NEW)
      )
    );
  exception when others then
    raise warning 'Snibble match_invited push trigger failed: %', SQLERRM;
  end;
  return NEW;
end;
$$;

drop trigger if exists on_sn_match_invited on public.sn_matches;
create trigger on_sn_match_invited
after insert on public.sn_matches
for each row
when (NEW.invited_user_id is not null)
execute function public.sn_notify_match_invited();
