-- Snibble: Realtime via "Broadcast from database" (realtime.send) instead of
-- postgres_changes. Idempotent; safe to re-run.
--
-- Topics (prefixed because the Supabase project is shared with other SQ games):
--   snibble:match:<match_id>   creator, opponent, invited user of that match
--   snibble:user:<user_id>     lobby feed for one user
-- Event name: 'change'. Payload:
--   { table, event, match_id, user_id?, status }
-- `user_id` is only present for table = 'sn_match_round_plays' (the player who
-- submitted). No `new` object: no client handler reads row fields, they just
-- refetch. Clients filter on table/event (+ user_id for plays) to keep the
-- old postgres_changes semantics.

-- ── 1. Trigger function ──────────────────────────────────────
create or replace function public.sn_broadcast_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_status   text;
  v_creator  uuid;
  v_opp      uuid;
  v_invited  uuid;
  v_play_uid uuid;
  v_payload  jsonb;
  v_uid      uuid;
begin
  if TG_TABLE_NAME = 'sn_matches' then
    -- Use OLD on DELETE (NEW is null there)
    if TG_OP = 'DELETE' then
      v_match_id := OLD.id;
      v_status   := OLD.status;
      v_creator  := OLD.creator_id;
      v_opp      := OLD.opponent_id;
      v_invited  := OLD.invited_user_id;
    else
      v_match_id := NEW.id;
      v_status   := NEW.status;
      v_creator  := NEW.creator_id;
      v_opp      := NEW.opponent_id;
      v_invited  := NEW.invited_user_id;
    end if;
    v_payload := jsonb_build_object(
      'table',    'sn_matches',
      'event',    TG_OP,
      'match_id', v_match_id,
      'status',   v_status
    );
  else
    -- sn_match_round_plays
    if TG_OP = 'DELETE' then
      v_match_id := OLD.match_id;
      v_play_uid := OLD.user_id;
    else
      v_match_id := NEW.match_id;
      v_play_uid := NEW.user_id;
    end if;
    if v_match_id is null then
      return coalesce(NEW, OLD);
    end if;
    select m.status, m.creator_id, m.opponent_id, m.invited_user_id
      into v_status, v_creator, v_opp, v_invited
      from public.sn_matches m where m.id = v_match_id;
    v_payload := jsonb_build_object(
      'table',    'sn_match_round_plays',
      'event',    TG_OP,
      'match_id', v_match_id,
      'user_id',  v_play_uid,
      'status',   v_status
    );
  end if;

  begin
    perform realtime.send(v_payload, 'change', 'snibble:match:' || v_match_id::text, true);

    -- One lobby message per distinct participant (creator, opponent, invitee).
    for v_uid in
      select v_creator where v_creator is not null
      union
      select v_opp     where v_opp     is not null
      union
      select v_invited where v_invited is not null
    loop
      perform realtime.send(v_payload, 'change', 'snibble:user:' || v_uid::text, true);
    end loop;
  exception when others then
    -- A Realtime hiccup must never abort the game write.
    raise warning 'sn_broadcast_match_change failed: %', sqlerrm;
  end;

  return coalesce(NEW, OLD);
end;
$$;

-- ── 2. Triggers ──────────────────────────────────────────────
-- Old subscriptions: sn_matches '*' (lobby) / UPDATE (match screen);
-- sn_match_round_plays INSERT only.
drop trigger if exists sn_matches_broadcast on public.sn_matches;
create trigger sn_matches_broadcast
  after insert or update or delete on public.sn_matches
  for each row execute function public.sn_broadcast_match_change();

drop trigger if exists sn_match_round_plays_broadcast on public.sn_match_round_plays;
create trigger sn_match_round_plays_broadcast
  after insert on public.sn_match_round_plays
  for each row execute function public.sn_broadcast_match_change();

-- ── 3. Realtime authorization (private channels) ─────────────
-- SECURITY DEFINER helper so the policy doesn't recurse through sn_matches
-- RLS. Ignores malformed topics instead of erroring.
create or replace function public.sn_can_read_match_topic(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_topic ~ '^snibble:match:[0-9a-fA-F-]{36}$'
    and exists (
      select 1
      from public.sn_matches m
      where m.id = substr(p_topic, 15)::uuid
        and (select auth.uid()) in (m.creator_id, m.opponent_id, m.invited_user_id)
    );
$$;

drop policy if exists "snibble_realtime_match_topic_select" on realtime.messages;
create policy "snibble_realtime_match_topic_select"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast')
    and public.sn_can_read_match_topic(realtime.topic())
  );

drop policy if exists "snibble_realtime_user_topic_select" on realtime.messages;
create policy "snibble_realtime_user_topic_select"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension in ('broadcast')
    and realtime.topic() = 'snibble:user:' || (select auth.uid())::text
  );

-- ── 4. NOT EXECUTED: run only AFTER the broadcast client has shipped ──
-- Removes the old postgres_changes sources (WAL decode load). Running this
-- earlier would break clients still on the old build (they fall back to the
-- 30s/60s polls).
-- alter publication supabase_realtime drop table public.sn_matches, public.sn_match_round_plays;
