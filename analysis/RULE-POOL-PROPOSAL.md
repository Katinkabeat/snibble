# Snibble — Rule Pool Expansion Proposal

**Status:** Draft / not applied. Game source unchanged.
**Goal:** Reduce match-mode rule-pair repeats without making puzzles bigger.

## Headline numbers

| Metric                      | Baseline (43 rules) | Proposed (93 rules) |
|-----------------------------|---------------------|---------------------|
| Viable rule pairs           | 184                 | **680** (+270%)     |
| Median intersection size    | 84 words            | 83 words            |
| Repeat odds in 5 matches    | 5.3%                | **1.5%**            |
| Repeat odds in 10 matches   | 22%                 | **6.4%**            |
| Repeat odds in 20 matches   | 66%                 | 25%                 |

Puzzle difficulty stays where it is — median intersection sizes are essentially unchanged because new rules are individually narrow.

## Why this works without making puzzles larger

What controls puzzle size is the *intersection* of the chosen pair, not how many rules exist. The `cravingGenerator.js` pipeline already:

- filters pairs with intersections under 30 words (too sparse)
- filters pairs where one rule mostly subsumes the other (>70% overlap)
- caps puzzle solutions at 30 via tray sampling

So adding narrow rules grows the *pool* combinatorially while each individual puzzle keeps the same word count.

## Proposed additions (50 rules)

### Suffix family (+9)
**Long (4-letter) suffixes** — naturally narrow, highly recognizable shapes:
- `-TION`, `-ABLE`, `-MENT`, `-NESS`, `-LESS`

**3-letter suffixes filling gaps:**
- `-ITE`, `-ORE`, `-AIN`, `-ICE`

### Contains family (+14)
**3-letter substrings** — narrower than the existing 2-letter ones:
- `-OUN-`, `-EAR-`, `-OUR-`, `-INE-`, `-ACK-`, `-ILL-`, `-ANG-`, `-ONG-`, `-UNG-`, `-IGH-`, `-OUS-`, `-TCH-`, `-NGE-`, `-RGE-`

### Starts-with family (+19)
**2-letter consonant-cluster prefixes:**
- `BL-`, `CL-`, `FL-`, `GL-`, `PL-`, `SL-`, `CR-`, `DR-`, `FR-`, `GR-`, `SC-`, `SK-`, `SM-`, `SN-`, `SP-`, `SW-`

**Common syllable prefixes:**
- `UN-`, `RE-`, `DE-`

### New families (+8)

**Length** (3 rules) — these are the highest-leverage additions, each contributing 45–60 viable pairs:
- exactly 5 letters
- exactly 6 letters
- 7+ letters

**Letter-set** (3 rules):
- has exactly one vowel
- contains no E
- contains a Y

**Pattern** (2 rules):
- ends with two consonants
- starts with two consonants

## What was tried and dropped

These were in the first draft but didn't pull their weight (intersection floor of 30 rejected them as pair members):

- 4-letter suffixes too narrow individually: `-OWN`, `-OUND`, `-ATCH`, `-OUGH`, `-SHIP`, `-HOOD`, `-WARD`, `-SIDE` (all matched 13–45 words → 0 viable pairs)
- 3-letter suffixes too narrow: `-AKE`, `-UCK`, `-ELL`, `-ASH`, `-USH`, `-OOL`, `-OON`, `-OAT`, `-EAT`, `-UMP`, `-UNK`
- Single-letter prefixes (`C-`, `D-`, `G-`, `H-`, `L-`, `P-`, `R-`, `T-`, `W-`) — they work but feel redundant with existing `B-`, `S-`, `F-`, `M-`

If you want to include the narrow ones later, lowering `MIN_PAIR_INTERSECTION` from 30 to 20 (in `cravingGenerator.js`) would let them in.

## Proposed `rules.js` diff (sketch — not applied)

```js
// ───────── Suffix rules ─────────
const SUFFIXES = [
  // ... existing 20 entries ...
  // NEW: long suffixes
  { suffix: 'TION', weight: 2 },
  { suffix: 'ABLE', weight: 2 },
  { suffix: 'MENT', weight: 1 },
  { suffix: 'NESS', weight: 1 },
  { suffix: 'LESS', weight: 1 },
  // NEW: 3-letter suffixes filling gaps
  { suffix: 'ITE', weight: 2 },
  { suffix: 'ORE', weight: 2 },
  { suffix: 'AIN', weight: 2 },
  { suffix: 'ICE', weight: 2 },
]

// ───────── Contains rules ─────────
const CONTAINS = [
  // ... existing 10 entries ...
  // NEW: 3-letter substrings
  { sub: 'OUN', weight: 3 },
  { sub: 'EAR', weight: 3 },
  { sub: 'OUR', weight: 3 },
  { sub: 'INE', weight: 3 },
  { sub: 'ACK', weight: 3 },
  { sub: 'ILL', weight: 3 },
  { sub: 'ANG', weight: 3 },
  { sub: 'ONG', weight: 2 },
  { sub: 'UNG', weight: 2 },
  { sub: 'IGH', weight: 3 },
  { sub: 'OUS', weight: 3 },
  { sub: 'TCH', weight: 2 },
  { sub: 'NGE', weight: 2 },
  { sub: 'RGE', weight: 2 },
]

// ───────── Starts-with rules ─────────
const STARTS_WITH = [
  // ... existing 10 entries ...
  // NEW: 2-letter consonant clusters
  { prefix: 'BL', weight: 3 },
  { prefix: 'CL', weight: 3 },
  { prefix: 'FL', weight: 3 },
  { prefix: 'GL', weight: 2 },
  { prefix: 'PL', weight: 3 },
  { prefix: 'SL', weight: 3 },
  { prefix: 'CR', weight: 3 },
  { prefix: 'DR', weight: 3 },
  { prefix: 'FR', weight: 3 },
  { prefix: 'GR', weight: 3 },
  { prefix: 'SC', weight: 3 },
  { prefix: 'SK', weight: 2 },
  { prefix: 'SM', weight: 2 },
  { prefix: 'SN', weight: 2 },
  { prefix: 'SP', weight: 3 },
  { prefix: 'SW', weight: 2 },
  // NEW: common syllable prefixes
  { prefix: 'UN', weight: 3 },
  { prefix: 'RE', weight: 3 },
  { prefix: 'DE', weight: 3 },
]

// ───────── New: length rules ─────────
const lengthRules = [
  {
    id: 'length:exact-5',
    family: 'length',
    label: 'exactly 5 letters',
    matches: (w) => w.length === 5,
    weight: 4,
  },
  {
    id: 'length:exact-6',
    family: 'length',
    label: 'exactly 6 letters',
    matches: (w) => w.length === 6,
    weight: 4,
  },
  {
    id: 'length:7-plus',
    family: 'length',
    label: '7+ letters',
    matches: (w) => w.length >= 7,
    weight: 3,
  },
]

// ───────── New: letter-set rules ─────────
const lettersetRules = [
  {
    id: 'letterset:one-vowel',
    family: 'letterset',
    label: 'has exactly one vowel',
    matches: (w) => w.length >= 3 && vowelCount(w) === 1,
    weight: 3,
  },
  {
    id: 'letterset:no-e',
    family: 'letterset',
    label: 'contains no E',
    matches: (w) => w.length >= 3 && !w.includes('E'),
    weight: 3,
  },
  {
    id: 'letterset:has-y',
    family: 'letterset',
    label: 'contains a Y',
    matches: (w) => w.length >= 3 && w.includes('Y'),
    weight: 3,
  },
]

// ───────── New: pattern rules ─────────
const patternRules = [
  {
    id: 'pattern:ends-2-consonants',
    family: 'pattern',
    label: 'ends with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[w.length-1]) && !isVowel(w[w.length-2]),
    weight: 3,
  },
  {
    id: 'pattern:starts-2-consonants',
    family: 'pattern',
    label: 'starts with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[0]) && !isVowel(w[1]),
    weight: 3,
  },
]

// Aggregated pool — append the new family arrays
export const BASE_RULES = [
  ...suffixRules,
  ...containsRules,
  ...startsRules,
  ...specialRules,
  ...lengthRules,         // NEW
  ...lettersetRules,      // NEW
  ...patternRules,        // NEW
]
```

## Redundancy considerations

The existing `rulesAreRedundant()` in `rules.js` already handles most cases (same family, contains-subsumed-by-affix, starts/contains-leading-letter, suffix/contains-trailing-letter). New rules slot in cleanly because:

- Length, letter-set, and pattern rules use new family names, so same-family elimination doesn't trigger between them and existing rules.
- The new contains/starts/suffix entries are all caught by the existing redundancy rules where applicable (e.g. `contains:OUN-` won't pair with `starts:O-` if that were ever added).

One minor case worth confirming if you ship this: `pattern:starts-2-consonants` vs every `starts:XY` two-letter cluster is *technically* implied (BL- words always start with two consonants). The intersection-overlap filter (>70% overlap = drop) probably catches it, but a redundancy guard could be added explicitly.

## What the player will feel

- New rule shapes that already feel familiar in word games: "end in -TION", "exactly 5 letters", "starts with BL-", "contains a Y"
- No change to puzzle word counts or difficulty distribution
- Genuinely fresh combinations match-to-match: e.g. "exactly 6 letters · contain -INE-" or "starts with CL- · ends in -ICE"

## Risk / regression check

- **Intersection cap:** `MAX_SOLUTIONS = 30` and the tray sampler already keep individual puzzles in range. Pairs with very large intersections (e.g. "contains no E · 7+ letters") will just regenerate trays until a tighter set hits. Expect slightly higher attempt counts on a few pair types — `MAX_REGENERATIONS = 200` has plenty of headroom.
- **Cache:** `cachedViablePairs` is process-lifetime; first match after deploy pays the O(rules²) one-time cost. With 93 rules that's ~4300 pairs to evaluate, ~0.5s at most on the dev box.
- **No state migration needed** — the rule list is code-only, no DB column changes.

## Files in this proposal

- [rule-pool-analysis.mjs](snibble/analysis/rule-pool-analysis.mjs) — broad analysis (86 candidate rules)
- [rule-pool-recommended.mjs](snibble/analysis/rule-pool-recommended.mjs) — final 50-rule subset analysis
- [RULE-POOL-PROPOSAL.md](snibble/analysis/RULE-POOL-PROPOSAL.md) — this doc
