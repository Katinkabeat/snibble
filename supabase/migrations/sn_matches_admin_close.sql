-- Snibble — admin close-match support.
--
-- Replaces the previous hard-DELETE admin flow (sn_matches_admin_delete.sql)
-- with a soft-close that marks the match as completed-with-no-winner so it
-- still shows in history with a "🛑 Game closed by admin" banner.
--
-- Reuses the shared `public.admins` table (Wordy/Rungles/Snibble all share
-- the same Supabase project) for the permission check.

-- ── 1. closed_by_admin column ─────────────────────────────────
alter table public.sn_matches
  add column if not exists closed_by_admin boolean not null default false;

-- ── 2. sn_admin_close_match ───────────────────────────────────
-- SECURITY DEFINER bypasses RLS so the admin can close any match
-- regardless of membership. Permission check enforced inside.
create or replace function public.sn_admin_close_match(p_match_id uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.admins
    where user_id = auth.uid()
      and 'close_games' = any(permissions)
  ) then
    raise exception 'Unauthorized: you do not have the close_games permission';
  end if;

  update public.sn_matches
  set status          = 'completed',
      completed_at    = now(),
      closed_by_admin = true,
      winner_id       = null
  where id = p_match_id
    and status in ('open', 'in_progress');

  if not found then
    raise exception 'Match not found or is already closed';
  end if;
end;
$$;

grant execute on function public.sn_admin_close_match(uuid) to authenticated;

-- ── 3. sn_admin_list_open_matches ─────────────────────────────
-- Returns all open + in_progress matches with player names, used
-- by the admin panel's Close Matches list.
create or replace function public.sn_admin_list_open_matches()
returns table (
  id                uuid,
  status            text,
  format            text,
  created_at        timestamptz,
  last_activity_at  timestamptz,
  creator_name      text,
  opponent_name     text
) language sql security definer stable as $$
  select
    m.id,
    m.status,
    m.format,
    m.created_at,
    m.last_activity_at,
    cp.username as creator_name,
    op.username as opponent_name
  from public.sn_matches m
  left join public.profiles cp on cp.id = m.creator_id
  left join public.profiles op on op.id = m.opponent_id
  where m.status in ('open', 'in_progress')
  order by m.last_activity_at desc
$$;

grant execute on function public.sn_admin_list_open_matches() to authenticated;
