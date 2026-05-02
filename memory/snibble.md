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

## Generator (v2 — phaseless, common-words-only)

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

**Solvability bounds:** regenerates up to 50× until
`12 ≤ totalSolutions ≤ 30`. Both bounds enforced. Anchor words for
the tray are pulled from common-words only so the tray biases toward
producing common-word solutions instead of being dominated by
rare-letter pulls.

**Solutions are common-words only.** Rare TWL words (ETUI, OBIA,
OILILY, OAT-rank-32k tier) are intentionally excluded — they're
rejected on submit as "isn't a word" so the puzzle stays fair
regardless of the player's vocabulary depth. Decision rationale: a
sample puzzle hit 554 valid TWL words against the old loose model;
common-words-only typically lands at 15–25.

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
  - Single round + best-of-3 (one craving revealed at a time per
    player; resolves per-round once both submit)
  - Lobby multiplayer card mirrors Rungles — Start a match button +
    unified list (open by anyone, your turn, waiting on them, recent
    completed). "N your turn" badge on the section header.
  - Rematch button on completed match (posts a new public match in
    the same format)
  - 7-day claim-win for stalled matches
  - Push notifications: opponent_joined + round_submitted triggers →
    snibble-push-notification Edge Function. Subscription fallback
    ['sidequest', 'snibble']; SQ hub opt-in covers most users.
    Edge Function counts plays directly to detect match-completion
    (since match.status updates after the play insert and the
    function may run before that).

**v2 still pending:**
- ⏳ Year-2 pet art (12 pets: Marlow, Hush, Acorn, Lily, Crumble,
  Pearl, Velvet, Whirr, Petal, Sprig, Marmalade, Wander). Marlow
  has art; the other 11 are catalog-only. Year-2 catalog migration
  drafted at `supabase/migrations/sn_pets_year2_roster.sql` but
  NOT applied yet — apply when art ships alongside.

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
