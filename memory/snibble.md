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

**Open follow-up:** rule-family variety. With the 7-tile tray + 32.6k
common-word list, suffix rules dominate the picker (most days fall
into `end in -X` cravings). Worth rebalancing weights in `rules.js`
in a future tuning pass — boost contains/starts/special weights, or
deweight suffix.

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
- ⏳ **Sanctuary screen** — biggest remaining piece
- ⏳ How to play content — deferred per Rae until gameplay finalises
- ⏳ Pip + Mochi adolescent/adult stages — not urgent (no tester
  reaches them for 31+ days)

**v2 (after first testers):**
- In-game leaderboard
- Async head-to-head matches (single round + best-of-3)
- Pets 4–6
- Streak counter
- Pet stages 2/3 for Pip + Mochi

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
