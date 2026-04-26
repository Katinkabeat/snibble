-- Snibble initial schema
-- Run this against the shared Supabase project (yyhewndblruwxsrqzart).
-- All tables prefixed `sn_` to avoid collisions with Wordy / Rungles.

-- ─────────────────────────────────────────────────────────────────────
-- sn_pets — the pet roster (canonical, shared by all players).
-- New pet = new row. Order matters — players unlock in order.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_pets (
  id              text primary key,           -- 'mossy', 'pip', 'mochi'
  name            text not null,              -- 'Mossy'
  species         text not null,              -- 'snail'
  unlock_order    int  not null,              -- 0=starter, 1=second, ...
  growth_required int  not null default 30,   -- successful sessions to graduate
  affinity_tags   text[] not null default '{}',
  description     text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- sn_progress — per-user pet progression.
-- One row per user per pet they've started or completed.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  pet_id       text not null references public.sn_pets(id),
  growth       int  not null default 0,       -- successful sessions for this pet
  graduated_at timestamptz,                   -- null if still growing
  started_at   timestamptz not null default now(),
  primary key (user_id, pet_id)
);

create index if not exists sn_progress_user_idx on public.sn_progress(user_id);

-- ─────────────────────────────────────────────────────────────────────
-- sn_daily_feeds — what the user fed their pet today.
-- One row per user per calendar day. Tracks words fed + score.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sn_daily_feeds (
  user_id      uuid not null references auth.users(id) on delete cascade,
  feed_date    date not null,                 -- Atlantic-time calendar date
  pet_id       text not null references public.sn_pets(id),
  words_fed    text[] not null default '{}',
  score        int  not null default 0,
  phases_done  int  not null default 0,       -- 0..3
  is_complete  boolean not null default false,-- true once all 3 phases done
  played_at    timestamptz not null default now(),
  primary key (user_id, feed_date)
);

create index if not exists sn_daily_feeds_user_idx on public.sn_daily_feeds(user_id);
create index if not exists sn_daily_feeds_date_idx on public.sn_daily_feeds(feed_date);

-- ─────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────
alter table public.sn_pets         enable row level security;
alter table public.sn_progress     enable row level security;
alter table public.sn_daily_feeds  enable row level security;

-- Pets: everyone can read (it's the catalog).
create policy "sn_pets read for all" on public.sn_pets
  for select using (true);

-- Progress: users see and modify only their own.
create policy "sn_progress read own" on public.sn_progress
  for select using (auth.uid() = user_id);
create policy "sn_progress write own" on public.sn_progress
  for insert with check (auth.uid() = user_id);
create policy "sn_progress update own" on public.sn_progress
  for update using (auth.uid() = user_id);

-- Daily feeds: users see and modify only their own.
create policy "sn_daily_feeds read own" on public.sn_daily_feeds
  for select using (auth.uid() = user_id);
create policy "sn_daily_feeds write own" on public.sn_daily_feeds
  for insert with check (auth.uid() = user_id);
create policy "sn_daily_feeds update own" on public.sn_daily_feeds
  for update using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Seed: v1 pet roster
-- ─────────────────────────────────────────────────────────────────────
insert into public.sn_pets (id, name, species, unlock_order, affinity_tags, description) values
  ('mossy', 'Mossy', 'snail',   0, array['short-suffix','soft-letters'], 'A patient little gardener.'),
  ('pip',   'Pip',   'firefly', 1, array['light-themes','-ight','-ow'],  'A tiny spark with big eyes.'),
  ('mochi', 'Mochi', 'bunny',   2, array['-y','double-letters'],         'Soft, hops, makes you smile.')
on conflict (id) do nothing;
