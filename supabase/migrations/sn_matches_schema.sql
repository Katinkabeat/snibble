-- Snibble — async head-to-head match schema (v2 multiplayer).
--
-- Three tables:
--   sn_matches            : one row per match (single or best-of-3)
--   sn_match_rounds       : 1 or 3 rows per match (puzzle for each round)
--   sn_match_round_plays  : one row per player per round once submitted
--
-- All prefixed sn_match_* to keep them clearly separate from the solo
-- daily-feed tables (sn_daily_feeds, sn_progress, sn_pets) and from
-- Wordy's `games`/`game_players` and Rungles' `rg_*` tables.

-- ─────────────────────────────────────────────────────────────────────
-- sn_matches
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_matches (
  id                uuid primary key default gen_random_uuid(),
  format            text not null check (format in ('single','best_of_3')),
  status            text not null default 'open'
                     check (status in ('open','in_progress','completed','expired')),
  creator_id        uuid not null references auth.users(id) on delete cascade,
  opponent_id       uuid references auth.users(id) on delete cascade,
  winner_id         uuid references auth.users(id),
  is_public         boolean not null default true,    -- show in open browser
  created_at        timestamptz not null default now(),
  joined_at         timestamptz,
  completed_at      timestamptz,
  last_activity_at  timestamptz not null default now()
);

create index if not exists sn_matches_status_idx       on public.sn_matches(status);
create index if not exists sn_matches_creator_idx      on public.sn_matches(creator_id);
create index if not exists sn_matches_opponent_idx     on public.sn_matches(opponent_id);
create index if not exists sn_matches_last_activity_idx on public.sn_matches(last_activity_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- sn_match_rounds
--   Pre-created at match creation time so the puzzle is locked + both
--   players see identical rules/letters. base_rule_ids is an array
--   because matches use combined rules (1 or 2 rules AND-ed together).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_match_rounds (
  match_id        uuid not null references public.sn_matches(id) on delete cascade,
  round_index     int  not null,                       -- 0, (1, 2 for best_of_3)
  seed            text not null,                       -- snibble:match:<id>:<idx>
  base_rule_ids   text[] not null,                     -- e.g. ['suffix:OW','special:double-letter']
  letters         text[] not null,                     -- 7-letter tray
  total_solutions int  not null,
  par_count       int  not null,
  difficulty      int  not null,
  primary key (match_id, round_index)
);

-- ─────────────────────────────────────────────────────────────────────
-- sn_match_round_plays
--   One row per player per round, written when they submit.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_match_round_plays (
  match_id     uuid not null references public.sn_matches(id) on delete cascade,
  round_index  int  not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  words_fed    text[] not null default '{}',
  score        int  not null default 0,
  submitted_at timestamptz not null default now(),
  primary key (match_id, round_index, user_id)
);

create index if not exists sn_match_round_plays_user_idx on public.sn_match_round_plays(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────
alter table public.sn_matches            enable row level security;
alter table public.sn_match_rounds       enable row level security;
alter table public.sn_match_round_plays  enable row level security;

-- Matches: any authed user can read (so the open browser works).
-- Insert your own (as creator). Update only if you're a participant.
create policy "sn_matches read all" on public.sn_matches
  for select using (auth.role() = 'authenticated');

create policy "sn_matches insert as creator" on public.sn_matches
  for insert with check (auth.uid() = creator_id);

create policy "sn_matches update participant" on public.sn_matches
  for update using (auth.uid() = creator_id or auth.uid() = opponent_id);

-- Rounds: readable to participants of the match.
create policy "sn_match_rounds read participant" on public.sn_match_rounds
  for select using (
    exists (
      select 1 from public.sn_matches m
      where m.id = match_id
        and (m.creator_id = auth.uid() or m.opponent_id = auth.uid())
    )
  );

create policy "sn_match_rounds insert participant" on public.sn_match_rounds
  for insert with check (
    exists (
      select 1 from public.sn_matches m
      where m.id = match_id
        and (m.creator_id = auth.uid() or m.opponent_id = auth.uid())
    )
  );

-- Plays: own writes, own reads always.
-- Opponent's plays readable only after BOTH players have submitted that
-- round (so you can't peek at their words mid-round).
create policy "sn_match_round_plays read own" on public.sn_match_round_plays
  for select using (auth.uid() = user_id);

create policy "sn_match_round_plays read opponent if both submitted" on public.sn_match_round_plays
  for select using (
    exists (
      select 1 from public.sn_match_round_plays mine
      where mine.match_id    = sn_match_round_plays.match_id
        and mine.round_index = sn_match_round_plays.round_index
        and mine.user_id     = auth.uid()
    )
  );

create policy "sn_match_round_plays write own" on public.sn_match_round_plays
  for insert with check (auth.uid() = user_id);
