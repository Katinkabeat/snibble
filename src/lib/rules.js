// ────────────────────────────────────────────────────────────
//  Craving rule families.
//
//  Each rule is a small object with:
//    id          — stable identifier
//    label       — human-readable description ("ends in -OW")
//    matches(w)  — boolean: does word w satisfy the rule?
//    weight      — sampling weight (higher = picked more often)
//    minWordLen  — words shorter than this are auto-rejected; lets
//                  us avoid e.g. matching "OW" alone for the -OW rule
//
//  All rules operate on uppercase strings.
//
//  v1 starts conservative (Mossy-friendly bias): common suffixes,
//  contains rules, length rules. Rare letters (Q/X/Z), prefix-heavy,
//  and pattern rules are commented-out for v1 and will be enabled in
//  later versions when harder pets ship.
// ────────────────────────────────────────────────────────────

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])
const isVowel = (c) => VOWELS.has(c)

/** Count vowels in a word. */
function vowelCount(w) {
  let n = 0
  for (const c of w) if (isVowel(c)) n++
  return n
}

/** Has a double letter (any two same letters in a row). */
function hasDoubleLetter(w) {
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1]) return true
  return false
}

// ───────── Suffix rules ─────────
// Weights deweighted (~halved) on 2026-04-30 because the suffix family
// was dominating ~67% of daily picks under the previous balance. Goal
// is ~40% of picks; contains/starts/special boosted to fill the gap.
// minSolutions: narrow suffixes can't seed 12 common words spellable from a
// single 7-letter tray (the suffix locks several slots). They pass at 8
// instead. Genuinely-too-narrow suffixes were removed entirely: OG/ARK/ALL/
// LESS/ICE (top out at 5-7 spellable) and EE (reachable but generates <10%
// of picks even at floor 8). See card #127 / memory session log.
const SUFFIXES = [
  // Common, friendly
  { suffix: 'OW',   weight: 3 },
  { suffix: 'AT',   weight: 3 },
  { suffix: 'IN',   weight: 3 },
  { suffix: 'EN',   weight: 3 },
  { suffix: 'ED',   weight: 3, minWordLen: 4 }, // skip "ED" alone
  { suffix: 'ER',   weight: 3, minWordLen: 4 },
  { suffix: 'ING',  weight: 3 },
  { suffix: 'LY',   weight: 2, minWordLen: 4 },
  { suffix: 'EAR',  weight: 2, minSolutions: 8 },
  { suffix: 'ICK',  weight: 2, minSolutions: 8 },
  { suffix: 'EST',  weight: 2 },
  { suffix: 'OOK',  weight: 2, minSolutions: 8 },
  { suffix: 'Y',    weight: 2, minWordLen: 3 },
  // Slightly trickier
  { suffix: 'IGHT', weight: 1, minSolutions: 8 },
  { suffix: 'ATE',  weight: 1 },
  { suffix: 'ION',  weight: 1 },
  // Long suffixes — naturally narrow, recognizable shapes
  { suffix: 'TION', weight: 2, minWordLen: 5 },
  { suffix: 'ABLE', weight: 2, minWordLen: 5, minSolutions: 8 },
  { suffix: 'MENT', weight: 1, minWordLen: 5, minSolutions: 8 },
  { suffix: 'NESS', weight: 1, minWordLen: 5, minSolutions: 8 },
  // 3-letter suffixes filling gaps
  { suffix: 'ITE',  weight: 2, minWordLen: 4, minSolutions: 8 },
  { suffix: 'ORE',  weight: 2, minWordLen: 4, minSolutions: 8 },
  { suffix: 'AIN',  weight: 2, minWordLen: 4, minSolutions: 8 },
]

const suffixRules = SUFFIXES.map(({ suffix, weight, minWordLen = 3, minSolutions }) => ({
  id: `suffix:${suffix}`,
  family: 'suffix',
  label: `end in -${suffix}`,
  craving: `a word ending in -${suffix}`,
  matches: (w) => w.length >= minWordLen && w.endsWith(suffix),
  weight,
  ...(minSolutions ? { minSolutions } : {}),
}))

// ───────── Contains rules ─────────
// Slightly boosted + a few new patterns added on 2026-04-30 for variety.
const CONTAINS = [
  { sub: 'OO', weight: 5 },
  { sub: 'EA', weight: 5 },
  { sub: 'OU', weight: 4 },
  { sub: 'EE', weight: 4 },
  { sub: 'CH', weight: 4 },
  { sub: 'SH', weight: 4 },
  { sub: 'TH', weight: 4 },
  { sub: 'AI', weight: 3 },
  { sub: 'OA', weight: 3 },
  { sub: 'ST', weight: 3 },
  // 3-letter substrings — narrower for richer pair variety
  { sub: 'OUN', weight: 3 },
  { sub: 'EAR', weight: 3 },
  { sub: 'OUR', weight: 3 },
  { sub: 'INE', weight: 3 },
  { sub: 'ACK', weight: 3 },
  { sub: 'ILL', weight: 3 },
  { sub: 'ANG', weight: 3 },
  { sub: 'ONG', weight: 2 },
  { sub: 'UNG', weight: 2, minSolutions: 8 },
  { sub: 'IGH', weight: 3 },
  { sub: 'OUS', weight: 3 },
  { sub: 'TCH', weight: 2 },
  { sub: 'NGE', weight: 2 },
  { sub: 'RGE', weight: 2 },
]

const containsRules = CONTAINS.map(({ sub, weight, minSolutions }) => ({
  id: `contains:${sub}`,
  family: 'contains',
  label: `contain -${sub}-`,
  craving: `a word with -${sub}-`,
  matches: (w) => w.length >= 3 && w.includes(sub),
  weight,
  ...(minSolutions ? { minSolutions } : {}),
}))

// ───────── Starts-with rules ─────────
// Boosted + expanded on 2026-04-30 (was very rarely picked; ~3% of days).
const STARTS_WITH = [
  { prefix: 'B',  weight: 5 },
  { prefix: 'S',  weight: 5 },
  { prefix: 'F',  weight: 4 },
  { prefix: 'M',  weight: 4 },
  { prefix: 'TH', weight: 3 },
  { prefix: 'PR', weight: 3 },
  { prefix: 'CH', weight: 3 },
  { prefix: 'BR', weight: 2 },
  { prefix: 'ST', weight: 2 },
  { prefix: 'TR', weight: 2 },
  // 2-letter consonant clusters
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
  // Common syllable prefixes
  { prefix: 'UN', weight: 3 },
  { prefix: 'RE', weight: 3 },
  { prefix: 'DE', weight: 3 },
]

const startsRules = STARTS_WITH.map(({ prefix, weight }) => ({
  id: `starts:${prefix}`,
  family: 'starts',
  label: `start with ${prefix}-`,
  craving: `a word starting with ${prefix}-`,
  matches: (w) => w.length >= 3 && w.startsWith(prefix),
  weight,
}))

// ───────── Special rules ─────────
// Boosted on 2026-04-30 + added "ends in a vowel" for more variety.
const specialRules = [
  {
    id: 'special:double-letter',
    family: 'special',
    label: 'contain a double letter',
    craving: 'a word with a double letter',
    matches: (w) => w.length >= 3 && hasDoubleLetter(w),
    weight: 8,
  },
  {
    id: 'special:vowel-rich',
    family: 'special',
    label: 'have 3 or more vowels',
    craving: 'a word with 3+ vowels',
    matches: (w) => w.length >= 4 && vowelCount(w) >= 3,
    weight: 6,
  },
  {
    id: 'special:ends-vowel',
    family: 'special',
    label: 'end in a vowel',
    craving: 'a word ending in a vowel',
    matches: (w) => w.length >= 3 && isVowel(w[w.length - 1]),
    weight: 5,
  },
]

// ───────── Length rules ─────────
// Word-length buckets — slice the dictionary cleanly and pair well
// with most other families. Only the 7+ FLOOR survives; see
// RETIRED_RULES below for why the exact-length ones were pulled.
const lengthRules = [
  {
    id: 'length:7-plus',
    family: 'length',
    label: '7 or more letters',
    craving: 'a long word (7+ letters)',
    matches: (w) => w.length >= 7,
    weight: 3,
  },
]

// ───────── Letter-set rules ─────────
// Constraints on which letters do/don't appear. Note: rack filler may
// still place these letters in the tray; players just won't be able
// to use them in solutions, same as today's "decorative" tiles.
const lettersetRules = [
  {
    id: 'letterset:one-vowel',
    family: 'letterset',
    label: 'has exactly one vowel',
    craving: 'a word with exactly one vowel',
    matches: (w) => w.length >= 3 && vowelCount(w) === 1,
    weight: 3,
  },
  {
    id: 'letterset:no-e',
    family: 'letterset',
    label: 'contains no E',
    craving: 'a word with no E',
    matches: (w) => w.length >= 3 && !w.includes('E'),
    weight: 3,
  },
  {
    id: 'letterset:has-y',
    family: 'letterset',
    label: 'contains a Y',
    craving: 'a word with a Y',
    matches: (w) => w.length >= 3 && w.includes('Y'),
    weight: 3,
  },
]

// ───────── Pattern rules ─────────
// Letter shape constraints at word boundaries.
const patternRules = [
  {
    id: 'pattern:ends-2-consonants',
    family: 'pattern',
    label: 'ends with two consonants',
    craving: 'a word ending in two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[w.length - 1]) && !isVowel(w[w.length - 2]),
    weight: 3,
  },
  {
    id: 'pattern:starts-2-consonants',
    family: 'pattern',
    label: 'starts with two consonants',
    craving: 'a word starting with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[0]) && !isVowel(w[1]),
    weight: 3,
  },
]

// ───────── Word-shape rules (added 2026-07-30) ─────────
// Whole-word shapes, as opposed to the pattern family above which only
// looks at the first or last two letters. Weight 3 across the board is
// the value they were measured at (see scripts/measure-candidate-rules.mjs)
// — don't raise one without re-running that script, since a rule that
// gets too broad silently stops appearing rather than erroring.
const shapeRules = [
  {
    id: 'shape:same-start-end',
    family: 'shape',
    label: 'starts and ends with the same letter',
    craving: 'a word starting and ending with the same letter',
    matches: (w) => w.length >= 4 && w[0] === w[w.length - 1],
    weight: 3,
  },
  {
    id: 'shape:ends-double',
    family: 'shape',
    label: 'ends in a double letter',
    craving: 'a word ending in a double letter',
    matches: (w) => w.length >= 4 && w[w.length - 1] === w[w.length - 2],
    weight: 3,
  },
  {
    id: 'shape:vowel-bookends',
    family: 'shape',
    label: 'starts and ends with a vowel',
    craving: 'a word starting and ending with a vowel',
    matches: (w) => w.length >= 4 && isVowel(w[0]) && isVowel(w[w.length - 1]),
    weight: 3,
  },
  {
    id: 'shape:three-consonants',
    family: 'shape',
    label: 'has three consonants in a row',
    craving: 'a word with three consonants in a row',
    matches: (w) => {
      if (w.length < 4) return false
      for (let i = 0; i + 2 < w.length; i++) {
        if (!isVowel(w[i]) && !isVowel(w[i + 1]) && !isVowel(w[i + 2])) return true
      }
      return false
    },
    weight: 3,
  },
  {
    id: 'shape:alternating',
    family: 'shape',
    label: 'alternates vowels and consonants',
    craving: 'a word alternating vowels and consonants',
    matches: (w) => {
      if (w.length < 4) return false
      for (let i = 1; i < w.length; i++) {
        if (isVowel(w[i]) === isVowel(w[i - 1])) return false
      }
      return true
    },
    weight: 3,
  },
  {
    id: 'shape:vowel-heavy',
    family: 'shape',
    label: 'has more vowels than consonants',
    // Strictly more than half the letters are vowels. Y counts as a
    // consonant here, same as everywhere else in this file.
    craving: 'a word with more vowels than consonants',
    matches: (w) => w.length >= 4 && vowelCount(w) * 2 > w.length,
    weight: 3,
  },
]

// ───────── Single-vowel rules ─────────
// Constrains WHICH vowel appears, not how many — so repeats are fine
// (BANANA satisfies only-A). Distinct from letterset:one-vowel, which
// caps the COUNT at one. A/E/O only: I and U can't seed enough common
// words from a 7-letter tray.
const SINGLE_VOWELS = ['A', 'E', 'O']

const singleVowelRules = SINGLE_VOWELS.map((v) => ({
  id: `vowelset:only-${v.toLowerCase()}`,
  family: 'vowelset',
  label: `uses only the vowel ${v}`,
  craving: `a word using only the vowel ${v}`,
  matches: (w) => {
    if (w.length < 4) return false
    let seen = false
    for (const c of w) {
      if (!isVowel(c)) continue
      if (c !== v) return false
      seen = true
    }
    return seen
  },
  weight: 3,
}))

// ───────── Retired rules ─────────
// Pulled from the sampling pool 2026-07-30 but deliberately still
// defined, because they are looked up BY ID in two places that outlive
// the pool:
//   1. sn_daily_puzzles stores each past day's base_rule_ids, and
//      dailyPuzzle.js resolves them through RULES_BY_ID to render the
//      craving. Deleting these blanks the craving on historical days.
//   2. sn_match_rounds does the same for in-flight match rounds, so
//      deleting mid-round would break word validation for that match.
//
// Why they went: scoring is 1 point per letter (cravingGenerator's
// scoreWord), so on an exact-length day every legal word is worth the
// same and a player's total collapses to (length × words fed). Everyone
// who filled the pet landed on an identical score, and the leaderboard
// was decided purely by submit time. The 7+ FLOOR has no such problem —
// length still varies above it.
//
// Do NOT put these back in BASE_RULES. Note also that setting weight: 0
// would NOT retire a rule: weightedPick does `it.weight || 1`, so a
// zero weight silently becomes 1.
export const RETIRED_RULES = [
  {
    id: 'length:exact-5',
    family: 'length',
    label: 'exactly 5 letters',
    craving: 'a 5-letter word',
    matches: (w) => w.length === 5,
  },
  {
    id: 'length:exact-6',
    family: 'length',
    label: 'exactly 6 letters',
    craving: 'a 6-letter word',
    matches: (w) => w.length === 6,
  },
]

// ───────── Aggregated base-rule pool ─────────
export const BASE_RULES = [
  ...suffixRules,
  ...containsRules,
  ...startsRules,
  ...specialRules,
  ...lengthRules,
  ...lettersetRules,
  ...patternRules,
  ...shapeRules,
  ...singleVowelRules,
]

/**
 * Map of id → rule for easy lookup. Includes RETIRED_RULES so stored
 * puzzles and in-flight match rounds referencing a retired id still
 * resolve — see the RETIRED_RULES comment above.
 */
export const RULES_BY_ID = Object.fromEntries(
  [...BASE_RULES, ...RETIRED_RULES].map((r) => [r.id, r])
)

// ───────── Phase modifiers (length + bonus) ─────────

/** Phase 2 typically adds a length floor. Returns a modifier rule. */
export function lengthMinModifier(min) {
  return {
    id: `mod:len-min:${min}`,
    family: 'mod',
    label: `${min}+ letters`,
    matches: (w) => w.length >= min,
  }
}

/** Phase 3 bonus — extra constraint on top of the base + length. */
export const PHASE3_BONUSES = [
  {
    id: 'bonus:starts-vowel',
    label: 'starts with a vowel',
    matches: (w) => w.length > 0 && isVowel(w[0]),
    weight: 3,
  },
  {
    id: 'bonus:starts-consonant',
    label: 'starts with a consonant',
    matches: (w) => w.length > 0 && !isVowel(w[0]),
    weight: 3,
  },
  {
    id: 'bonus:ends-vowel',
    label: 'ends in a vowel',
    matches: (w) => w.length > 0 && isVowel(w[w.length - 1]),
    weight: 3,
  },
  {
    id: 'bonus:double-letter',
    label: 'contain a double letter',
    matches: (w) => hasDoubleLetter(w),
    weight: 3,
  },
  {
    id: 'bonus:has-vowel-pair',
    label: 'contains two vowels in a row',
    matches: (w) => /[AEIOU]{2}/.test(w),
    weight: 2,
  },
  {
    id: 'bonus:vowel-rich',
    label: 'have 3 or more vowels',
    matches: (w) => vowelCount(w) >= 3,
    weight: 2,
  },
]

// ───────── Helpers ─────────

/**
 * True if rule A logically implies rule B (every word matching A also
 * matches B), or vice versa. Used to keep match-mode from pairing two
 * rules that say the same thing — e.g. "contains OO" + "contain a
 * double letter", or "starts with TH" + "contains -TH-".
 */
export function rulesAreRedundant(a, b) {
  if (a.id === b.id) return true

  const part = (r) => r.id.split(':')[1] || ''
  const isDouble = (s) => s.length >= 2 && /^(.)\1+$/.test(s)
  const endsDouble = (s) =>
    s.length >= 2 && s[s.length - 1] === s[s.length - 2]

  // Anything that guarantees a double letter is redundant with the
  // special:double-letter rule.
  const guaranteesDouble = (r) => {
    if (r.id === 'special:double-letter') return true
    if (r.family === 'contains' && isDouble(part(r))) return true
    if (r.family === 'suffix' && endsDouble(part(r))) return true
    return false
  }
  if (guaranteesDouble(a) && guaranteesDouble(b)) return true

  // contains:X subsumed by starts:X or suffix:X when the affix already
  // includes that substring (e.g. starts:TH ⇒ contains:TH).
  const containsSub = (r) => (r.family === 'contains' ? part(r) : null)
  const affix = (r) =>
    r.family === 'starts' || r.family === 'suffix' ? part(r) : null
  const aSub = containsSub(a)
  const bSub = containsSub(b)
  const aAffix = affix(a)
  const bAffix = affix(b)
  if (aSub && bAffix && bAffix.includes(aSub)) return true
  if (bSub && aAffix && aAffix.includes(bSub)) return true

  // "starts:X" + "contains:Y" read as the same rule when Y begins with
  // X's leading letter — both spotlight the same letter at the front
  // of the word (e.g. starts:S + contains:ST, starts:S + contains:SH).
  if (a.family === 'starts' && b.family === 'contains'
      && part(b)[0] === part(a)[0]) return true
  if (b.family === 'starts' && a.family === 'contains'
      && part(a)[0] === part(b)[0]) return true

  // Symmetric for the tail of the word: "suffix:X" + "contains:Y" when
  // Y ends with X's last letter (e.g. suffix:AT + contains:ST both
  // anchor on a final T-cluster).
  if (a.family === 'suffix' && b.family === 'contains') {
    const pa = part(a), pb = part(b)
    if (pa.length && pb.length && pb[pb.length - 1] === pa[pa.length - 1]) return true
  }
  if (b.family === 'suffix' && a.family === 'contains') {
    const pa = part(a), pb = part(b)
    if (pa.length && pb.length && pa[pa.length - 1] === pb[pb.length - 1]) return true
  }

  return false
}

/** Combine multiple rules into one (all must match). */
export function combineRules(rules) {
  const labels = rules.map((r) => r.label)
  return {
    id: 'combined:' + rules.map((r) => r.id).join('+'),
    family: 'combined',
    label: labels.join(' · '),
    matches: (w) => rules.every((r) => r.matches(w)),
  }
}

/** Weighted random pick using the provided rng. */
export function weightedPick(rng, items) {
  const total = items.reduce((s, it) => s + (it.weight || 1), 0)
  let r = rng.next() * total
  for (const it of items) {
    r -= it.weight || 1
    if (r <= 0) return it
  }
  return items[items.length - 1]
}
