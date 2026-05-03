-- ============================================================
-- SNIBBLE — Track who closed a match and why
-- Run AFTER sn_matches_admin_close.sql.
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 1. NEW COLUMNS ────────────────────────────────────────────
alter table public.sn_matches
  add column if not exists closed_by    uuid references auth.users(id),
  add column if not exists close_reason text;

-- ── 2. UPDATED sn_admin_close_match ───────────────────────────
-- Reason is REQUIRED — empty/null raises an exception.
drop function if exists public.sn_admin_close_match(uuid);

create or replace function public.sn_admin_close_match(
  p_match_id uuid,
  p_reason   text
)
returns void language plpgsql security definer as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_reason is null then
    raise exception 'A reason is required to close a match';
  end if;

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
      winner_id       = null,
      closed_by       = auth.uid(),
      close_reason    = v_reason
  where id = p_match_id
    and status in ('open', 'in_progress');

  if not found then
    raise exception 'Match not found or is already closed';
  end if;
end;
$$;

grant execute on function public.sn_admin_close_match(uuid, text) to authenticated;

-- ── 3. ADMIN VIEW: recently closed matches ───────────────────
create or replace function public.sn_admin_list_closed_matches(p_limit int default 50)
returns table (
  id              uuid,
  completed_at    timestamptz,
  close_reason    text,
  closed_by_name  text,
  creator_name    text,
  opponent_name   text
) language sql security definer stable as $$
  select
    m.id,
    m.completed_at,
    m.close_reason,
    cb.username as closed_by_name,
    cp.username as creator_name,
    op.username as opponent_name
  from public.sn_matches m
  left join public.profiles cp on cp.id = m.creator_id
  left join public.profiles op on op.id = m.opponent_id
  left join public.profiles cb on cb.id = m.closed_by
  where m.closed_by_admin = true
  order by m.completed_at desc
  limit p_limit
$$;

grant execute on function public.sn_admin_list_closed_matches(int) to authenticated;
