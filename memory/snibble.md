# Snibble — Project Details

In-repo session log + tech reference. The high-level concept and locked
design decisions live in user memory at `project_sq_snibble.md`. The
SQ-wide conventions all SQ games follow live in
`rae-side-quest/docs/sq-conventions.md`.

## Overview
Cozy solo word game, part of Rae's Side Quest. Single craving per day;
feed a critter qualifying words; raise it ~30 sessions and graduate it
to your sanctuary.

- **Repo:** github.com/Katinkabeat/snibble
- **Live:** katinkabeat.github.io/snibble/
- **Supabase:** shares Wordy's project (`yyhewndblruwxsrqzart`); tables
  prefixed `sn_*`.
- **Stack:** React 18 + Vite + Tailwind + Supabase JS + react-hot-toast.
  (Same stack as Wordy. Rungles is being ported to match.)

## Deployment
- GitHub Actions auto-deploys on push to `main` (`.github/workflows/deploy.yml`)
- Build secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- gh CLI auth + git push works fine from this workspace (no
  index.lock issues like Wordy has)

## File map
```
src/
├── App.jsx                      # auth gate + view router (?play=daily, ?view=pets, default=lobby)
├── main.jsx                     # ReactDOM root + ThemeProvider
├── index.css                    # Tailwind layers + Wordy-aligned dark mode rules
├── contexts/ThemeContext.jsx    # light/dark, persisted to localStorage `snibble-theme`
├── hooks/
│   ├── useActivePet.js          # reads sn_progress; defaults to seeding Mossy on first visit
│   ├── useDailyState.js         # reads/writes sn_daily_feeds; resetToday + markComplete
│   └── useProfile.js            # reads SQ profiles table for username + avatar_hue
├── lib/
│   ├── dictionary.js            # TWL words.txt + common-words.txt loaders, with Node override
│   ├── rng.js                   # FNV-1a + mulberry32; dailySeedString uses America/Halifax
│   ├── rules.js                 # rule families (suffix, contains, starts, special) + weighted pick
│   └── cravingGenerator.js      # generatePuzzle: one rule, total + par counts, difficulty stars
└── components/
    ├── LobbyView.jsx            # landing: pet hero card, daily mode card, two-player + sanctuary placeholders
    ├── GameView.jsx             # daily play loop (header, habitat, fullness bar, builder, tray, buttons)
    ├── PetPreview.jsx           # /snibble/?view=pets — admin reference for pet artwork
    ├── SnibbleHeader.jsx        # sticky header (avatar + name + 🏠 + ⚙️) per SQ conventions
    ├── SnibbleAvatarMenu.jsx    # identity dropdown (avatar card + Stats placeholder)
    ├── SnibbleSettingsDropdown.jsx  # cog: Theme, How-to-play, Redo today, Admin toggles, Log out
    └── pets/
        ├── Mossy.jsx            # snail, 3 stages (baby/adolescent/adult)
        ├── Pip.jsx              # firefly, baby only (3/4 view, butt-glow lantern)
        └── Mochi.jsx            # bunny, baby only

public/
├── words.txt                    # TWL Scrabble dictionary (173k words, copied from Wordy)
└── common-words.txt             # 32,639 common words (top 50k Google English × TWL)

supabase/migrations/
├── sn_initial_schema.sql        # sn_pets, sn_progress, sn_daily_feeds + RLS
└── sn_app_settings.sql          # feature flags, sn_admin_reset_leaderboard RPC, DELETE policy

scripts/
├── preview-cravings.mjs         # 30-day generator preview (Node, uses globalThis.__SNIBBLE_*__)
└── test-determinism.mjs         # same-seed → same-puzzle assertion
```

## Database

Tables (all `sn_*` prefixed):

- `sn_pets` — canonical pet roster. Seeded with Mossy (id `mossy`), Pip
  (`pip`), Mochi (`mochi`). RLS: read for all.
- `sn_progress` — per-user, per-pet growth. Columns: user_id, pet_id,
  growth (0..30), graduated_at, started_at. RLS: own only.
- `sn_daily_feeds` — per-user-per-day session state. Columns: user_id,
  feed_date (Atlantic), pet_id, words_fed text[], score, phases_done
  (vestigial post-v2), is_complete, played_at. RLS: own only, plus a
  DELETE policy for self (used by Redo today).
- `sn_app_settings` — flat key/value flags. Seeded with
  `redo_today_enabled = false`. RLS: read for all, write for admins.

Functions:

- `sn_admin_reset_leaderboard()` — SECURITY DEFINER, admin-only,
  truncates `sn_daily_feeds`. Used to clear test scores before public
  launch. Pet growth (`sn_progress`) is preserved.

## Daily seed + rollover

- Calendar day rollover at **midnight Atlantic Time** (`America/Halifax`,
  auto-handles AST ↔ ADT). `dailySeedString(date)` formats the date in
  that timezone and produces `snibble:daily:YYYY-MM-DD`.
- Generator is fully deterministic from the seed. Same seed in, same
  puzzle out (verified by `scripts/test-determinism.mjs`).
- Match seeds (v2) will use the same RNG with `snibble:match:<id>` seeds.

## Generator (v2 — phaseless; common-words *target*, full-TWL *acceptance*)

Single rule per day. Output:

```js
{
  seed,
  base: { id, label, family },
  letters: ['A', 'B', ...],     // 7 letters (matches Wordy's rack size)
  totalSolutions: number,        // common-word matches that are spellable from tray
  parCount: number,              // ~60% of totalSolutions (mid-session celebration tick)
  difficulty: 1 | 2 | 3,         // ★ from totalSolutions: ≥22 → ★, ≥17 → ★★, else ★★★
  sampleSolutions, sampleCommon  // QA-only previews
}
```

**Solvability bounds:** regenerates up to 150× (was 50; bumped
2026-05-21 for the full-dict guard below) until
`12 ≤ totalSolutions ≤ 30`. Both bounds enforced. Anchor words for
the tray are pulled from common-words only so the tray biases toward
producing common-word solutions instead of being dominated by
rare-letter pulls.

**Target vs acceptance are decoupled (changed 2026-05-21).**
`totalSolutions` / par / 100% are still computed from common-words
only (so the bar fills at ~12–30). But feeds are now *accepted*
against the full TWL list (`isValidWord`, 173k) — a player who knows
a real but uncommon word (ETUI, BABOO, BATE) gets it in as bonus
instead of being told "isn't a word". To keep the acceptable pool
bounded, generation applies a `FULL_DICT_CAP = 50` guard: after the
common gate passes, count every TWL word the tray would accept and
regenerate if > 50. Modeled mean ~34 acceptable/game, hard max 50.
Same guard + acceptance in `generateMatchPuzzle` so daily and match
are uniform. (Old behavior: common-only acceptance, rejecting all
rare TWL words — that's what players complained about.)

Rule families weighted (in `rules.js`):
- Suffix (-OW, -AT, -IN, -OG, -EN, -ED, -ER, -ING, -LY, -EAR, -ICK,
  -ALL, -EST, -OOK, -ARK, -EE, -Y, -IGHT, -ATE, -ION)
- Contains (-OO-, -EA-, -OU-, -EE-, -CH-, -SH-, -TH-)
- Starts-with (B, S, TH, PR, CH)
- Special (double letter, vowel-rich)

Rule labels are written in "that"-clause form (`end in -OW`,
`start with CH-`, `contain -OO-`, `have 3 or more vowels`) so the
craving banner reads `${pet} is hungry for words that ${label}`.

Rare letters (Q, X, Z), prefix-heavy rules, palindromes are NOT enabled
for v1 (Mossy-friendly bias). Add later for harder pets.

**Generator tuning (2026-04-30):** rule-family weights rebalanced.
Before: ~67% suffix dominance (suffix family weight total = 81 vs
contains 23, starts 12, special 5). After: target distribution
~33/29/24/14 across suffix/contains/starts/special. Changes:
- Suffix weights ~halved (most 5→3, lowest 2→1)
- Contains: bumped existing + added -AI-, -OA-, -ST-
- Starts-with: bumped existing + added F-, M-, BR-, ST-, TR-
- Special: bumped existing + added "end in a vowel"

Verified via `node scripts/preview-cravings.mjs`. 30-day sample now
shows all four families regularly + better easy/medium/hard mix.

### Scoring

`scoreWord(word)` = `word.length`. One point per letter, no Scrabble
values, no length bonuses. Keeps day-to-day scores comparable
regardless of which rare letters the craving lands on. Rationale: a
Z-heavy day under Scrabble values inflated everyone's score 2× over
a vowel-heavy day; flat per-letter scoring removes that distortion.

## UI design — locked

**Cog dropdown layout:**
1. Theme (real toggle, persists to `snibble-theme`)
2. How to play (placeholder; lands once gameplay is settled per Rae)
3. **Redo today** (only visible if `redo_today_enabled` flag is true)
4. Admin section (only if user is admin):
   - Allow redo today (toggle the flag for everyone)
   - Reset leaderboard (RPC call with confirm)
5. Log out (rose colour)

**Game view layout (top → bottom):**
- Craving banner (single line, gold gradient): `${pet} is hungry for
  words that ${rule}`. No difficulty stars on the game page — the
  lobby card surfaces difficulty.
- Pet habitat card: compact (`max-w-[140px]` pet, `p-3` card padding).
  Pet name + growth count are NOT shown on the game page; the lobby
  card already has them.
- Fullness bar inside the pet card.
- Word builder (full-width, flex-wrap for long words). Tap a built
  tile to remove it.
- Letter tray: 7 letters, `flex flex-wrap justify-center` (matches
  Wordy's rack size). Tap a tile to append it to the built word.
  Letters are reusable (tray is a hint, not a rack).
- Action row, 4-up grid: `[Feed 🍃] [Clear] [Shuffle] [Done 🌙]`.
  Feed = `.btn-primary`, others = `.btn-secondary`. Done-for-today
  is a two-tap confirm (label flips to "Sure?" for 3 seconds before
  the second tap commits).
- Shuffle button randomises tray order in place via Fisher-Yates.

**Fullness bar:**
- Pink-to-purple fill = `wordsFed / totalSolutions`
- Vertical amber tick at `parCount / totalSolutions` = par line
  (parCount is now derived as `~60% of totalSolutions` since solutions
  are already common-words only)
- Crossing par triggers a celebration toast
- Hitting 100% triggers "Mossy is FULL — you got them all!"

**Milestone toasts** at 5, 10, 25, 50 words fed.

**Feed validation order** (in `handleFeed`, `GameView.jsx`):
1. Duplicate check first → toast `${petName} already ate that!`
2. Common-word check → toast `"${word}" isn't a word`
3. Rule match → toast `${pet} turns away — wants ${rule label}`
4. Accept → record feed, score = `word.length`, update fullness bar.

The dup-first ordering matters: the previous order checked the
dictionary first, so a previously-fed word that happened to fail the
common-word test would say "isn't a word" instead of the friendlier
"already ate that".

## Styling — Wordy is the source of truth

Per the SQ conventions doc (`rae-side-quest/docs/sq-conventions.md`):

- All SQ games inherit dark mode from Wordy's `src/index.css` `.dark .*`
  rules. Don't invent dark-mode color values.
- Game-specific accent elements (Snibble's gold craving banner) can
  use any palette in light mode, but in dark mode must use values from
  Wordy's purple palette (`#0f0a1e`, `#1a1130`, `#221540`, `#2d1b55`,
  `#3d2070`, `#4c1d95`, `#6d28d9`, `#7c3aed`).
- Body styling matches Wordy verbatim: `background-color: #faf5ff`,
  `color: #3b0764`. Wrapper divs carry the gradient via
  `bg-gradient-to-br from-wordy-50 via-pink-50 to-wordy-100
  dark:bg-[#0f0a1e] dark:bg-none`.
- `.tile`, `.tile-placed`, `.btn-primary`, `.btn-secondary`, `.card`
  are lifted verbatim from Wordy's index.css.

**Tailwind via-stop gotcha:** `via-pink-50` hardcodes `#fdf2f8` into
`--tw-gradient-stops`, so overriding `--tw-gradient-via` in dark mode
doesn't reach the middle stop. Workaround: `dark:bg-[#0f0a1e]
dark:bg-none` on wrapper divs (clears the gradient + paints flat dark).

## Admin tools (testing-phase)

Two admin-only buttons in the cog dropdown:

1. **Allow redo today** — flips `sn_app_settings.redo_today_enabled`.
   When ON, every player sees a "Redo today" row in their cog dropdown.
   Tapping it deletes their `sn_daily_feeds` row for today and reloads.
   *Caveat*: doesn't roll back the +1 growth tick. Acceptable for
   testing; gated behind the admin flag so production users won't
   trigger it.

2. **Reset leaderboard** — calls `sn_admin_reset_leaderboard()` RPC.
   Truncates `sn_daily_feeds` (all users, all dates). Pet growth
   (`sn_progress`) is preserved. Use before going public to clear
   test scores. Confirms before destructive action.

The `sn_app_settings` table + the RPC live in
`supabase/migrations/sn_app_settings.sql`.

## Build phases — what's done vs left

**v1 ship-to-private-testers:**
- ✅ Repo + scaffold + GH Pages + Supabase
- ✅ SQ hub catalog row (admin-bypass via Phase 7 gating)
- ✅ Craving generator + solvability check + determinism
- ✅ Dictionary + common-words list + par line
- ✅ Difficulty stars (lobby surfaces them; game page is clean)
- ✅ 1-point-per-letter scoring (Scrabble values + length bonuses
  removed 2026-04-29 for cross-day comparability)
- ✅ Common-words-only puzzle (totalSolutions bounded 12–30, dict
  expanded to 32.6k words on 2026-04-29)
- ✅ Mossy 3 stages + Pip baby + Mochi baby
- ✅ Lobby + GameView with header per SQ conventions
- ✅ Avatar menu + cog dropdown
- ✅ Phaseless single-craving model (rationale: phases created
  dead-ends; see project_sq_snibble.md)
- ✅ 7-tile tray (`flex flex-wrap`); 4-up action row Feed/Clear/
  Shuffle/Done; Done is a two-tap confirm
- ✅ Admin testing tools (Redo today + Reset leaderboard)
- ✅ Dark mode aligned to Wordy
- ✅ **Sanctuary screen** — Pokemon-style card grid (PetCard +
  PetModal + SanctuaryView + useSanctuary hook). Hard-mode hints
  hardcoded in `src/lib/petHints.js`. Full 13-pet roster seeded
  in `sn_pets`.
- ⏳ How to play content — deferred per Rae until gameplay finalises
- ⏳ Pip + Mochi adolescent/adult stages — not urgent (no tester
  reaches them for 31+ days)

**v2 — shipped 2026-04-30 to 2026-05-01:**
- ✅ Daily leaderboard + StatsModal (avatar menu → 📊 Stats)
  - Two tabs: 🏆 Today (gated until you submit) and 📊 My Stats
  - Leaderboard rows expand independently to show word lists, sorted
    A–Z so you can scan for words you missed
  - End-of-session auto-pops the leaderboard with your row highlighted
- ✅ Streak counter on lobby pet card (purple `Daily Streak 🔥 N` pill,
  right-aligned to match progress bar; uses Wordy's player-pill style)
- ✅ Async head-to-head matches (1v1 — Rae locked in cozier than 3+):
  - sn_matches / sn_match_rounds / sn_match_round_plays tables
  - Combined-rule cravings (~80% combined, 20% single) on a 7-letter
    tray; smart rule-pairing precompute caches viable AND-able pairs
  - Single round only (best-of-3 was removed 2026-05-03 to align all
    SQ games on a uniform "click Create → match posted" flow). The
    `sn_matches.format` column is vestigial — always 'single' on new
    rows; harmless to leave.
  - Lobby multiplayer card mirrors Rungles — Start a match button +
    unified list (open by anyone, your turn, waiting on them, recent
    completed). "N your turn" badge on the section header.
  - Rematch button on completed match (posts a new public match)
  - 7-day claim-win for stalled matches
  - Push notifications: opponent_joined + round_submitted triggers →
    snibble-push-notification Edge Function. Subscription fallback
    ['sidequest', 'snibble']; SQ hub opt-in covers most users.
    Edge Function counts plays directly to detect match-completion
    (since match.status updates after the play insert and the
    function may run before that).

**v2 — year-2 roster shipped:**
- ✅ Year-2 catalog migration (`supabase/migrations/sn_pets_year2_roster.sql`)
  applied — all 12 pets present in `sn_pets` with `unlock_order` 13–24
  (Marlow, Hush, Acorn, Lily, Crumble, Pearl, Velvet, Whirr, Petal,
  Sprig, Marmalade, Wander).
- ✅ All 12 year-2 PNGs in `public/pets/` and registered in
  `src/lib/pets.jsx` PET_COMPONENTS.

## 2026-05-01 session — multiplayer fix + art swap + UX polish

- **Multiplayer join bug fixed:** added `sn_matches join open` RLS
  policy so a non-creator can claim an open match. Without it, the
  UPDATE filtered to 0 rows and `.single()` threw "cannot coerce".
- **Match generator tightened:** cap 50→30 solutions, always-combined
  rules (single-rule rounds were blowing past the cap), 4-letter
  minimum on solutions and submit input. Toast "Words must be 4+
  letters" when shorter words are tried.
- **Admin delete (superseded same day):** original implementation
  added a delete RLS policy + 🗑 button on every lobby match row.
  Replaced later in the day by the soft-close flow below — the
  per-row 🗑 buttons were removed in favor of a dedicated panel.
- **Pet art system swapped:** SVG components → PNG images. 14 pets
  processed (year 1 + Marlow). Pipeline saved in user memory at
  `reference_snibble_pet_art_pipeline.md` — BiRefNet + hard alpha
  threshold (200) + bbox crop + 5% margin + 512×512 LANCZOS resize.
  `src/lib/pets.jsx` exports a `<PetImage>` wrapper with
  `object-contain` so pets don't squish in non-square slots
  (sanctuary card especially). Single image per pet — growth bar
  still tracks progress, picture just doesn't change with stage.
  All `src/components/pets/*.jsx` SVG files removed.
- **Match draft persistence:** `wordsFed` saved to localStorage
  keyed by `snibble:match:<id>:r<idx>:u<uid>:words` so closing the
  app or navigating away mid-round preserves progress. Cleared on
  successful submission.

## Admin close-match (added later 2026-05-01)

- **`sn_matches.closed_by_admin` BOOLEAN column** + new RPC
  `sn_admin_close_match(p_match_id)` (security-definer, gated on
  `admins.permissions @> ['close_games']`). Sets status='completed',
  winner_id=null, closed_by_admin=true. Plus
  `sn_admin_list_open_matches` RPC for the panel.
- **UX swap:** removed the per-row 🗑 trash buttons from
  MultiplayerCard and the inline `isAdmin`/`handleCancel` logic.
  Replaced with a dedicated `AdminPanel.jsx` (Close Matches view)
  reachable from the settings dropdown's "Admin panel · 🔐 Open"
  row, routed via `?view=admin`. Matches Wordy/Rungles' separate-
  panel pattern.
- **Banners updated:** CompletedPanel in MatchView shows
  🛑 + "Game closed by admin"; lobby completed-row status shows
  "🛑 Closed by admin". `closed_by_admin` added to the useMatches
  select.
- Migration: `supabase/migrations/sn_matches_admin_close.sql`. The
  earlier `sn_matches_admin_delete.sql` policy is now unused — the
  delete RLS rule still exists but nothing in the app calls it.

**v3:**
- Pets 7–13 (full year roster)
- Seasonal/event pets
- Generator tuning + possibly themed days

## 2026-05-03 session — split completed matches into own SQ card

Finished match banners were rendering inside `MultiplayerCard` (above the
active list). Wordy and Rungles use a separate `SQCompletedGamesCard`
section below their multiplayer card, so Snibble was the odd one out.

Changes:
- New `CompletedMatchesSection.jsx` wraps `CompletedMatchBanner` in
  `SQCompletedGamesCard` (title: "🏁 Completed Matches"), matching
  Rungles' `CompletedGamesSection` pattern.
- `useMatches` lifted from `MultiplayerCard` up to `LobbyView` so both
  the multiplayer card and the new completed section can read from one
  fetch (no duplicate query). `MultiplayerCard` now takes `mine` as a
  prop; the in-component `useMatches()` call was removed.
- `LobbyView` renders the new section between Multiplayer and Sanctuary.
- `CompletedMatchBanner` outer `<div className="space-y-2 mb-3">`
  removed since `SQCompletedGamesCard` provides spacing — banner now
  returns a fragment-style array of `BannerRow`s.
- `CreateMatchSheet`'s `onCreated` callback switched from a key-bump
  refresh trick to `mine.reload()` since the hook now lives in
  `LobbyView`.

## 2026-05-02 session — lobby perf + completed-match dismiss banner

**Lobby loading was slow** — `MultiplayerCard` ran two hooks
(`useMatches` + `useOpenMatches`) and gated the whole card on
`mine.loading || others.loading`. `useMatches` itself made 3 sequential
Supabase round-trips (matches → plays → profiles), with no `.limit()` on
the unbounded match-history query.

Fixes (commit `5f6aba0`):
- `useMatches`: added `.limit(50)` to the matches query; parallelized
  the plays + profiles fetches with `Promise.all` (3 round-trips → 2).
- `MultiplayerCard`: split the loading state so "your matches" renders
  as soon as `useMatches` finishes, independent of `useOpenMatches`.
  Each section now appears in its own slot rather than waiting for
  both hooks.

**Completed-match dismiss banners** (separate change, same day):
- Added `creator_dismissed_at` / `opponent_dismissed_at` columns to
  `sn_matches`. Each player can dismiss their own banner without
  affecting the other player's view; the row stays in the DB.
- New `CompletedMatchBanner.jsx` component renders above the active
  match list — persistent banner card with score subtext + ✕ button.
- `useMatches` selects the new columns + the per-play `score` field,
  computes `yourScore` / `theirScore` / `myDismissedAt` per match, and
  filters `buckets.completed` to undismissed only. Plays are also
  fetched for any undismissed completed match (not just in_progress).
- The old "last 5 completed rows" inline list in `MultiplayerCard` was
  removed in favour of the banner.

## 2026-05-02 session — match-mode rule-pair dedupe

Players were seeing rule pairs that read as the same constraint twice:
"start with S-" + "contain -ST-", and earlier "contain -OO-" + "double
letter" wording overlap. `family`-based filtering wasn't enough because
the families differ (starts vs contains, special vs contains).

Two layers added:

- **Tighter `rulesAreRedundant` in `src/lib/rules.js`:** flags
  `starts:X` + `contains:Y` when Y begins with X's leading letter
  (catches starts:S + contains:ST, contains:SH, etc.). Symmetric
  `suffix:X` + `contains:Y` when Y ends with X's last letter.
- **Overlap-ratio cap in `getViableRulePairs`** (`MAX_PAIR_OVERLAP_RATIO
  = 0.7`): rejects pairs where one rule's match set is mostly a subset
  of the other's. Belt-and-suspenders for future rules.

Tuning dial: lower the ratio to tighten, raise it (toward 0.8) if the
viable-pair pool feels too thin. `getViableRulePairs` is cached, so cost
is paid once per page load.

Commit `5efc275`.

## 2026-05-04 session — rule pool expansion + history dedup

Match mode was repeating combos too often (Rae saw "starts B + ends ER"
twice in 5 matches). Two fixes shipped together:

**Rule pool expanded from 43 → 93 rules (`src/lib/rules.js`).** Added:

- 9 new suffixes (long: `-TION`, `-ABLE`, `-MENT`, `-NESS`, `-LESS`;
  3-letter: `-ITE`, `-ORE`, `-AIN`, `-ICE`)
- 14 new contains (3-letter substrings: `-OUN-`, `-EAR-`, `-INE-`,
  `-ACK-`, `-ILL-`, `-OUS-`, `-IGH-`, `-NGE-`, `-TCH-`, etc.)
- 19 new starts-with (consonant clusters: `BL-`, `CL-`, `FL-`, `CR-`,
  `GR-`, `SP-`, etc.; syllable prefixes: `UN-`, `RE-`, `DE-`)
- 3 new families:
  - `length` (exactly 5 / exactly 6 / 7+ letters)
  - `letterset` (one vowel / no E / has Y)
  - `pattern` (starts or ends with two consonants)

Viable pair pool grew from 184 → ~680. Median pair-intersection
unchanged at 84 words, so puzzle difficulty is preserved. The
existing redundancy + overlap filters in `cravingGenerator.js` handle
all the new rule shapes without modification.

**Recent-pair dedup at `createMatch` time (`src/lib/matchActions.js`).**
`generateMatchPuzzle` now accepts an `excludePairKeys` Set option;
`createMatch` queries the new RPC `sn_recent_match_rule_ids` for the
last 15 matches' rule pairs per player and filters them out. Friend
invites dedup against both players' history; open matches against
the creator's history only (opponent unknown at creation).

The RPC is `security definer` because RLS on `sn_match_rounds` blocks
non-participants from reading rule IDs. Migration:
`supabase/migrations/sn_recent_match_rule_ids.sql`. Returns just
`text[]` rule-id rows — letters/scores/submissions stay protected.

Same-pair odds in 5 matches dropped from 5.3% → 1.5%; 30-match
sliding window simulation produced 0 repeats. Stress test in
`analysis/match-stress-test.mjs`.

Commit `639da9f`.

## 2026-05-04 session — perf sweep + invite deep-link fix

Rae reported general SQ slowness, especially when inviting a friend
to a Snibble match. Audited the codebase and shipped four fixes:

**Invite deep-link regression (MatchView.jsx).** Push notifications
deep-link to `/snibble/?match=<id>`, but MatchView had no branch for
"current user is the invitee on an open match" — invitees saw the
generic `OpenMatchPanel` ("waiting for someone to join from their
lobby's match list") instead of being dropped into play. Added auto-
accept: when `match.status === 'open' && match.invited_user_id ===
user.id`, MatchView fires `joinMatch` once on mount (guarded by a
ref) and refreshes. Brief "Accepting invite…" panel during the round
trip. Commit `9efb386`.

**createMatch parallelization (matchActions.js).** The rule-pair
history RPC and the sn_matches insert had no dependency on each
other — only the puzzle generation downstream needs both. Promise.all
collapses one round-trip (~100-200ms). Confirmed by Rae as feeling
"100x faster." Commit `b10464f`.

**Pet load 2 queries → 1 (useActivePet.js).** Used PostgREST
embedded-resource syntax to pull sn_progress + the related sn_pets
catalog row in one trip:
```js
.from('sn_progress')
.select(`*, sn_pets ( id, name, species, unlock_order, growth_required )`)
```
First-visit path (no progress row yet) still does two queries but
parallelizes them. Commit `f748b8f`.

**expireStaleMatches throttled (useMatches.js).** Every reload()
click was firing the sweep RPC. Module-level throttle keeps it to
once per 5 min per session. Worst-case visual lag (a just-expired
match still appearing as open) is bounded by the interval — fine
since the sweep is for stale matches nobody is interacting with.
Commit `5f7e51b`.

**NOTE on the "synchronous push trigger" red herring.** Initial
audit flagged `sn_notify_match_invited` as a blocking HTTP POST in
the AFTER-INSERT trigger. Wrong — `pg_net.net.http_post` is async by
design (returns a request_id; the actual HTTP call runs in a
background worker). The trigger does NOT block the INSERT. Real
wins were the four above.

**Indexes already covered.** Snibble migrations already index
sn_progress.user_id, sn_matches.creator_id/opponent_id/invited_user_id,
sn_matches.last_activity_at, sn_match_round_plays.user_id. No new
indexes needed for Snibble specifically.

## 2026-05-21 session — full-TWL acceptance + ≤50 guard

Player complaint (via a Snibble player): real words they know get
rejected. Root cause: feeds were validated against common-words only.

Fix (commit d4788b3, shipped): decouple acceptance from the target.
- `GameView.jsx` + `MatchView.jsx`: feed gate `isCommonWord` →
  `isValidWord` (full TWL). `validateFeed` in cravingGenerator.js too.
- `cravingGenerator.js`: added `FULL_DICT_CAP = 50` guard to both
  `generatePuzzle` and `generateMatchPuzzle` (count full-TWL feedable
  words after the common gate; regenerate if > 50).
- `MAX_REGENERATIONS` 50 → 150 so the guard never hard-errors.

Modeling (3,000 simulated days, real generator logic): uncapped mean
~45 (outliers to 158); ≤50 guard → mean ~34, hard max 50, ~7 regen
attempts avg, 0 failures. Rejected alternatives: ≤60 cap (16% over
50), dropping the 6 broad rules (whack-a-mole, barely moved avg), and
2-rule cravings for daily/match (intersection barely lowers count,
~52 regen attempts, makes the cozy daily harder — not a word-count
lever). Decision: single rule in BOTH modes, uniform acceptance.
Design discussion + numbers on Raeban card #127.

Verified locally in daily + match against the live modules: BABOO/BATE
now accepted, guard held across 80 seeds (max pool 50/49, 0 fails).

**Follow-ups (both fixed same day, commit 9b916fa):**
- *17 "dead" rules.* Root cause was NOT too few common words (they have
  25-233 each) — it's that a suffix locks several of the 7 tray slots,
  so no single tray can spell 12 of the matching common words (best
  achievable 5-11). Fix: per-rule `minSolutions` override (default 12)
  set to 8 on rules that can reach 8, threaded into both generators'
  anchor + solution-count gates. Revived 11 (EAR/ICK/OOK/IGHT/AIN/UNG
  generate ~100% when picked; MENT/ITE/ORE/ABLE/NESS 29-77%). Dropped 6
  that floor-8 still can't revive: OG/ARK/ALL/LESS/ICE (top out 5-7) +
  EE (reachable but <10% gen). Pool 93 → 87. Verified: 0 daily failures
  over 150 seeds, avg 5.7 attempts.
- *Stale comment.* `dictionary.js` header said "4355 words"; corrected
  to ~32,639 + clarified target-vs-acceptance split.

## Known gotchas

- **Vite `import.meta.env.BASE_URL`** doesn't exist in Node. Test
  scripts pre-populate `globalThis.__SNIBBLE_DICTIONARY__` /
  `__SNIBBLE_COMMON_WORDS__` to bypass the fetch path.
- **Dictionary loaded at runtime** (not bundled) — keeps the JS
  bundle small (~110 KB gzip). Cached separately by the browser.
- **`phases_done` column** on `sn_daily_feeds` is vestigial post-v2;
  persisted as 0 to keep schema valid. Prune later.
- **Auth gate redirect** — if a visitor hits `/snibble/` while
  unauthed, they bounce to `/games/?return=%2Fsnibble%2F`. The hub
  signs them in and bounces back via its return-URL allowlist.
- **Per-game theme key** — Snibble uses `snibble-theme` localStorage
  key. Wordy uses `wordy-theme`. Each game tracks its own theme
  preference (no cross-game sync).


### Session: 2026-05-20 — MP easing + 4-letter floor + persisted daily puzzles (c10)

Three intertwined changes from card c10 ("decide multiplayer challenge level"):

1. **Multiplayer easing.** Match rounds now pick a **single weighted rule** like the daily, not two AND-ed rules. The combined-rule + viable-pair machinery (`getViableRulePairs`, `MIN_PAIR_INTERSECTION`, `MAX_PAIR_OVERLAP_RATIO`, `combineRules`/`rulesAreRedundant` imports) was removed from `cravingGenerator.js`. `rulePairKey` stays (now keys single-rule history for dedup). `matcherFromBaseIds` already handled 1-element arrays, so DB + validation needed no change. The head-to-head is the challenge now, not the puzzle.

2. **4-letter floor in BOTH modes.** Unified `MIN_WORD_LENGTH = 4` constant used by daily + match generators. Daily previously counted 2–3-letter words in `totalSolutions` but the Feed button blocks <4 — so the "you got them all" 100% clear was **unreachable on ~67% of days** (measured against HEAD over 730 seeds). Now the daily solution loop filters `w.length < MIN_WORD_LENGTH`, so par/100% only count feedable words. GameView handler guard aligned 3→4 (button was already 4). MatchView guard/button/toast 4. HowToPlay copy: "4 letters or longer", `GROW = 4` example, match section "one rule like the daily".

3. **Persisted daily puzzles** (the durable fix Rae asked for). New table `sn_daily_puzzles` (puzzle_date PK, base_rule_ids, letters, total_solutions, par_count, difficulty) + SECURITY DEFINER RPC `sn_get_or_create_daily_puzzle` (insert-if-absent, date-guarded ±1 Atlantic day). New `lib/dailyPuzzle.js` `loadDailyPuzzle()`: SELECT-first, generate+RPC-store if absent, falls back to unpersisted local puzzle on RPC error. Replaced `generateTodaysPuzzle()` at all 3 call sites (GameView, LobbyView, useSoloLeaderboard). **Why:** the daily was recomputed live from the date seed every load, so any generator change silently re-rolled the in-progress day. Stored scores (`sn_daily_feeds.score`) were never affected — leaderboards sum stored facts — but the puzzle itself wasn't reproducible across a deploy. Now a generator change only affects days not yet started.

**Deploy sequencing (important):** the migration + today's seed row MUST be applied before the new client deploys, else clients hit a missing table and the loader falls back to re-rolling today with the new generator. Migration was applied via the Supabase **dashboard SQL editor** (psql couldn't resolve the retired direct host `db.<ref>.supabase.co`; `.env.supabase` has the direct URL, not the pooler). Today (2026-05-20) was seeded with the live OLD puzzle (`suffix:IN` / `AIMETNS` / 12 / 8 / 3) so today stays untouched; tomorrow onward generates fresh under the new code.

Verified: match generator stress test 100/100 single-rule; daily generator 730/730 seeds with 4-letter filter (12–30 solutions, no failures); `vite build` green. Live 2-player match feel + in-app daily load still want a human playtest (needs auth + opponent).

### Session: 2026-05-19 — Stats modal → routed page (c92 polish round 2)

Converted Snibble's stats from a modal (`<dialog>`-style overlay) to a full routed page, matching Yahdle's pattern.

- **New `StatsPage.jsx`** uses `SQLobbyShell + SnibbleHeader + "← Back to lobby"`. Same chrome as Yahdle.
- **Route:** `?view=stats` — added handler in App.jsx alongside `?view=sanctuary` etc.
- **Avatar menu:** SnibbleAvatarMenu's "📊 Stats" item now pushState-navigates to `?view=stats` instead of opening the modal. Removed `statsOpen` state + StatsModal import.
- **Post-"Done for today" flow:** GameView used to auto-pop the StatsModal after the player finishes the daily puzzle. Now it pushState-navigates to `?view=stats`. Player lands on the leaderboard page (unlocked, since they just submitted) and can navigate back via "← Back to lobby".
- **Visual tokens** switched from `wordy-*` to neutral `white/N` classes (`bg-white/5`, `bg-white/15 ring-white/30`, `border-white/10`, `opacity-70`) so the page is pixel-identical to Yahdle's. Verified: row `background-color: rgba(255, 255, 255, 0.05)`, `color: rgb(237, 224, 255)` — matches Yahdle exactly.
- **StatsModal.jsx deleted.** All its internals (LeaderboardTab, LeaderboardLocked, LeaderboardRow, SegmentedControl, DateStepper, MyStatsTab) now live in StatsPage with the new chrome.
- Snibble-specific bits preserved on the page: play-to-see gate for Day+today, word-list expansion (Day tab + has-permission), percent vs. puzzle.totalSolutions for Day+today, "Test ← you" appended-rank row.

### Session: 2026-05-19 — Extended leaderboards (c92, second game shipped)

Ported the c92 leaderboard pattern from Yahdle. Now Day / Week / Month / All-time, with a date stepper on the Day tab to scroll back through past days.

- **New RPCs** (additive — old `sn_daily_leaderboard` left alive for one deploy cycle):
  - `sn_solo_leaderboard(p_timeframe text, p_date date default current_date)` — top 10 per window. Day: per-day score + `words_fed` array. Week/Month/All: SUM(score), SUM(words_count), `words_fed` null (no aggregate concat).
  - `sn_solo_my_rank(p_timeframe, p_date)` — caller's rank/score.
- **Play-to-see gate now contextual**, not whole-tab. Gate only triggers when viewing TODAY's Day tab (`p_date = (timezone('America/Halifax', now()))::date`). Past days and Week/Month/All-time are open to everyone, including users who haven't submitted today. Card c92 decision.
- **Server is the source of truth for "today"** — RPC computes `v_today` from Halifax tz, no client flag. Cleaner contract.
- **Migration** (no timestamp prefix per the standardized SQ convention, see [supabase patterns](../../.claude/projects/.../feedback_supabase_patterns.md)): `supabase/migrations/sn_extended_leaderboards.sql`. Applied via psql + pooler URL.
- **Hook renamed** `useDailyLeaderboard` → `useSoloLeaderboard({ timeframe, date, currentUserId, todayIso })`. Returns `{ rows, myRank, locked, loading, error, reload }`. Empty Day-today result → `locked: true`. Percent vs. puzzle.totalSolutions only computed for Day+today (puzzle is today-specific). Other timeframes/days get `percent: null`.
- **StatsModal redesign:**
  - Tab label `🏆 Today` → `🏆 Leaderboard` (timeframe-aware now).
  - Auto-switch to MyStats on no-submit removed — Leaderboard tab now has useful content (past days, aggregates) even when today is locked.
  - LeaderboardLocked only shown for (Day + today + !submittedToday).
  - Word expansion only shown for Day tab + rows with `wordsFed.length > 0` AND (past day OR submittedToday). For Today + submitted: see your own + others' words. For past days: see everyone's words always (per locked decision).
  - Appended "your rank #N" row when caller is outside top 10 — fed by `sn_solo_my_rank`.
- **Verified locally** via SQ All preview at `localhost:8080/snibble/`. Test user (not submitted today): Day-today shows lock, Day-yesterday shows Dino 122 / snuggie 117 / Rae 87 with word expansion, Week shows Dino 213 / Rae 161 / snuggie 117 (sums correct), Month/All-time include Test as rank 5 with 7 pts (naturally in top 10, no appended row needed). No console errors.
- Raeban card [c92] still in flight (Rungles pending).

### Session: 2026-05-03 — Completed Matches: drop dismiss flow

Mirrored Wordy/Rungles' completed-games fix to Snibble:
- **Always show 10:** `useMatches` no longer filters out matches with `creator_dismissed_at` / `opponent_dismissed_at`. The Completed Matches section now always shows the 10 most recent.
- **Removed dismiss UI:** `CompletedMatchBanner` no longer renders the X button or `dismissing` state. "Result" link renamed to "View Game" to match Wordy/Rungles. `dismissMatch` helper deleted from `lib/matchActions.js`. `LobbyView` no longer passes `onDismissed`.

Note: `sn_matches.creator_dismissed_at` / `opponent_dismissed_at` columns still exist in the DB — harmless leftovers, no need to migrate them out.

Snibble's query already ordered on the parent table (`last_activity_at`) so there was no order-by bug to fix here, just the dismiss UX alignment.

**Commit:** `5734188`.


### Session: 2026-05-03 — Invite-a-friend feature

Added private friend-invite flow on top of the existing open-match flow. Same single "Start a match" button now opens a sheet with two modes: 🌍 Open (anyone joins, 7-day auto-cancel) and 👥 With a friend (only invitee joins, 3-day auto-cancel).

**Schema (`sn_matches_invite_friend.sql`, applied to live DB):**
- `sn_matches.invited_user_id` (uuid?) — if set, only this user can see + join
- `sn_matches.expires_at` (timestamptz) — auto-set by `sn_set_match_expiry` BEFORE-INSERT trigger; 3d for invited, 7d for open
- `sn_matches.cancelled_at` (timestamptz?) — set when creator manually cancels
- New status value `'cancelled'` added to check constraint
- Read-RLS replaced — invited matches hidden from non-participants (creator/invitee/opponent only)
- New RPC `sn_cancel_match(uuid)` — creator-only, blocked once any plays exist
- New RPC `sn_expire_stale_matches()` — sweeps past-expiry open matches to status='expired'; lobby calls lazily on load
- New trigger `on_sn_match_invited` → POSTs to snibble-push-notification with type=`match_invited`
- The existing `sn_matches join open` policy already permits the invitee to claim (uses `creator_id <> auth.uid()`), no extra policy needed

**Edge function update (deployed):** `match_invited` handler in `snibble-push-notification` — looks up inviter username, sends "Snibble — match invite: {inviter} invited you to a match" push to invitee.

**Frontend:**
- `src/hooks/useFriends.js` — fetches accepted friends from hub's `friendships` + `profiles` tables (no duplication; same data source as hub's Friends panel)
- `src/components/CreateMatchSheet.jsx` (rebuilt) — toggle (Open / With a friend), search input, scrollable friend list with avatar chips + checkbox, dynamic action button label (`Send invite to {name}`)
- `src/lib/matchActions.js` — `createMatch({ userId, invitedUserId? })` flips `is_public=false` when invited; new `cancelMatch({ matchId })` and `expireStaleMatches()` helpers
- `src/hooks/useMatches.js` — new `invitedToYou` bucket; query OR'd to include `invited_user_id.eq.<me>`; filters out cancelled; lazy-calls `expireStaleMatches` before reading
- `src/components/MultiplayerCard.jsx` — owns the sheet state; renders `invitedToYou` rows with amber Accept button; creator's waiting-for-opponent rows show ✕ cancel + "📨 Invited {name}" subtext when invited

**Verified in preview:** sheet opens with Open mode by default, toggle swaps to friend mode, 3 accepted friends load (Krispy/Onyi/snuggie), search filters as you type, friend selection updates button label to "Send invite to {name}", cancel ✕ buttons appear on existing waiting-for-opponent rows.

**Auto-expiry:** lazy via `sn_expire_stale_matches()` called on each lobby load. Cron is a future add.

**Cancelled vs expired UX:** cancelled matches disappear from lobby entirely (clean disappearance). Expired matches still appear in completed banner so user sees their open match timed out.


### Session: 2026-05-03 — Drop best-of-3 + create-match popup

Goal: align all three SQ games on a uniform "click Create → match posted" flow. Wordy's create flow (player-count picker only) and Rungles' (single button, fixed 10 rungs) were already minimal; Snibble's two-step format picker was the odd one out.

Changes:
- Deleted `CreateMatchSheet.jsx` entirely. `MultiplayerCard` now owns the Start-a-match button + a local `creating` state, calling `createMatch` directly.
- `LobbyView` no longer carries `showCreateMatch` state or the popup mount.
- `createMatch({ userId })` — dropped `format` param. Always inserts `format: 'single'` and pre-creates exactly one round.
- `submitMatchRound` — `total = 1` (was branched on `match.format`). `useMatches` `roundCount` collapsed to constant 1.
- Stripped format label from `MatchRow`, `OpenMatchPanel`, `AdminPanel` lobby row, and dropped `format` from useMatches' SELECT lists. MatchView's rematch handler no longer threads `match.format` through.
- `sn_matches.format` column left in DB (vestigial, same pattern as `phases_done`).

Confirmed in preview: lobby renders, network queries 200, no console errors. No active best-of-3 matches in flight at time of change (Rae confirmed).


### Session: 2026-05-06 — Match ties on equal scores

Previously, equal total scores awarded the win to whichever player submitted their final round earlier (first-to-finish tiebreak via `submitted_at` query). Changed to a true tie: equal scores → `winner_id = null`.

The UI already handled `winner_id === null` as "🤝 A tie!" (line 410 of `MatchView.jsx`), so no frontend changes needed. Only `submitMatchRound()` in `src/lib/matchActions.js` was modified — removed the `else` branch that queried `sn_match_round_plays.submitted_at` to pick the earlier submitter.

Push notifications unaffected — the Edge Function just says "match complete!" without naming a winner.

**Commit:** `d6ee069`.



### Session: 2026-05-13 — Daily leaderboard privacy fix

Onyi noticed she could see Rae's in-progress word list before Rae submitted her daily. `sn_daily_leaderboard` was `SECURITY DEFINER` and returned every row matching the date with no `is_complete` filter — score showed live on each row, and `words_fed` sat in the JSON payload (client-side `canSeeWords` gate only hid the expand UI, not the data).

Fix in `supabase/migrations/sn_daily_leaderboard.sql`:
- `where f.is_complete = true` on the returned rows → in-progress players don't appear on the leaderboard until they submit.
- `exists (select 1 from sn_daily_feeds caller where caller.user_id = auth.uid() and caller.is_complete = true)` → non-submitted callers get zero rows (defense-in-depth — the existing client gate is no longer the only thing protecting submitted players' words).

Applied to prod via Supabase Management API SQL endpoint (`POST /v1/projects/{ref}/database/query` with `SUPABASE_ACCESS_TOKEN`). Direct `db.*.supabase.co` host now returns only IPv6, so `psql` fails on networks without v6. The pooler URLs need explicit tenant-prefixed user (`postgres.<ref>`) which I didn't know without trial-and-error. Management API was the cleanest path.

No frontend change. `useDailyLeaderboard` keeps working; `canSeeWords` UI gate is now redundant but harmless defense-in-depth.

**Verified:** function source on prod matches via `pg_get_functiondef`; test account (incomplete) gets 0 rows; 3 real completed players today, 0 in-progress at time of fix.

**Commit:** `070613b`.
