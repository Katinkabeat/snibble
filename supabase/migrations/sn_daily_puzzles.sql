-- ============================================================
-- Snibble — Persisted daily puzzles
--
-- Pins each day's craving in the DB so that a generator code change
-- only affects days that haven't started yet. Before this, the daily
-- puzzle was recomputed live from the date seed on every load, so any
-- change to cravingGenerator.js silently re-rolled the current day's
-- puzzle for everyone who reloaded. Stored scores were never affected
-- (sn_daily_feeds.score is a stored fact) — but the puzzle itself was
-- not reproducible across a deploy. This table fixes that.
--
-- Mirrors the sn_match_rounds pattern: store base_rule_ids + tray +
-- counts; reconstruct labels/matchers client-side from RULES_BY_ID.
--
-- Generation stays client-side (the generator is JS + the word list),
-- but it's deterministic, so two clients on the same code compute the
-- identical puzzle. The RPC below is the only writer: first writer for
-- a date wins (on conflict do nothing), everyone else reads that row.
-- ============================================================

create table if not exists public.sn_daily_puzzles (
  puzzle_date     date primary key,
  base_rule_ids   text[] not null,            -- daily is a single rule, e.g. ['suffix:IN']
  letters         text[] not null,            -- 7-letter tray
  total_solutions int  not null,
  par_count       int  not null,
  difficulty      int  not null,
  created_at      timestamptz not null default now()
);

alter table public.sn_daily_puzzles enable row level security;

-- Any authed user can read the day's puzzle. Puzzles aren't secret —
-- the client could compute them anyway; storing just pins the value.
create policy "sn_daily_puzzles read all" on public.sn_daily_puzzles
  for select using (auth.role() = 'authenticated');

-- No direct insert/update/delete policies: writes go only through the
-- SECURITY DEFINER RPC below, which guards the date.

-- ── get-or-create ────────────────────────────────────────────
-- Insert the supplied puzzle if the date has no row yet, then return
-- the authoritative row for that date. Idempotent: a second call with
-- different values is a no-op (on conflict do nothing) and returns the
-- already-stored row, so all clients converge on one puzzle per day.
--
-- Date guard: only today ±1 (Atlantic) may be created, which blocks a
-- malicious client from pre-seeding far-future days with a bogus tray.
-- ±1 tolerates clock skew / the midnight rollover boundary.
create or replace function public.sn_get_or_create_daily_puzzle(
  p_date          date,
  p_base_rule_ids text[],
  p_letters       text[],
  p_total         int,
  p_par           int,
  p_difficulty    int
)
returns public.sn_daily_puzzles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('America/Halifax', now()))::date;
  v_row   public.sn_daily_puzzles;
begin
  if p_date < v_today - 1 or p_date > v_today + 1 then
    raise exception 'sn_get_or_create_daily_puzzle: p_date % out of allowed range (today=%)', p_date, v_today;
  end if;

  insert into public.sn_daily_puzzles
    (puzzle_date, base_rule_ids, letters, total_solutions, par_count, difficulty)
  values
    (p_date, p_base_rule_ids, p_letters, p_total, p_par, p_difficulty)
  on conflict (puzzle_date) do nothing;

  select * into v_row from public.sn_daily_puzzles where puzzle_date = p_date;
  return v_row;
end;
$$;

revoke all on function public.sn_get_or_create_daily_puzzle(date, text[], text[], int, int, int) from public;
grant execute on function public.sn_get_or_create_daily_puzzle(date, text[], text[], int, int, int) to authenticated;
