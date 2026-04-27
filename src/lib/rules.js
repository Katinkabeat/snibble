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
const SUFFIXES = [
  // Common, friendly
  { suffix: 'OW',   weight: 6 },
  { suffix: 'AT',   weight: 6 },
  { suffix: 'IN',   weight: 5 },
  { suffix: 'OG',   weight: 5 },
  { suffix: 'EN',   weight: 5 },
  { suffix: 'ED',   weight: 5, minWordLen: 4 }, // skip "ED" alone
  { suffix: 'ER',   weight: 5, minWordLen: 4 },
  { suffix: 'ING',  weight: 5 },
  { suffix: 'LY',   weight: 4, minWordLen: 4 },
  { suffix: 'EAR',  weight: 4 },
  { suffix: 'ICK',  weight: 4 },
  { suffix: 'ALL',  weight: 4 },
  { suffix: 'EST',  weight: 4 },
  { suffix: 'OOK',  weight: 3 },
  { suffix: 'ARK',  weight: 3 },
  { suffix: 'EE',   weight: 3 },
  { suffix: 'Y',    weight: 4, minWordLen: 3 },
  // Slightly trickier
  { suffix: 'IGHT', weight: 2 },
  { suffix: 'ATE',  weight: 2 },
  { suffix: 'ION',  weight: 2 },
]

const suffixRules = SUFFIXES.map(({ suffix, weight, minWordLen = 3 }) => ({
  id: `suffix:${suffix}`,
  family: 'suffix',
  label: `ends in -${suffix}`,
  matches: (w) => w.length >= minWordLen && w.endsWith(suffix),
  weight,
}))

// ───────── Contains rules ─────────
const CONTAINS = [
  { sub: 'OO', weight: 4 },
  { sub: 'EA', weight: 4 },
  { sub: 'OU', weight: 3 },
  { sub: 'EE', weight: 3 },
  { sub: 'CH', weight: 3 },
  { sub: 'SH', weight: 3 },
  { sub: 'TH', weight: 3 },
]

const containsRules = CONTAINS.map(({ sub, weight }) => ({
  id: `contains:${sub}`,
  family: 'contains',
  label: `contains -${sub}-`,
  matches: (w) => w.length >= 3 && w.includes(sub),
  weight,
}))

// ───────── Starts-with rules ─────────
const STARTS_WITH = [
  { prefix: 'B',  weight: 3 },
  { prefix: 'S',  weight: 3 },
  { prefix: 'TH', weight: 2 },
  { prefix: 'PR', weight: 2 },
  { prefix: 'CH', weight: 2 },
]

const startsRules = STARTS_WITH.map(({ prefix, weight }) => ({
  id: `starts:${prefix}`,
  family: 'starts',
  label: `starts with ${prefix}-`,
  matches: (w) => w.length >= 3 && w.startsWith(prefix),
  weight,
}))

// ───────── Special rules ─────────
const specialRules = [
  {
    id: 'special:double-letter',
    family: 'special',
    label: 'contains a double letter',
    matches: (w) => w.length >= 3 && hasDoubleLetter(w),
    weight: 3,
  },
  {
    id: 'special:vowel-rich',
    family: 'special',
    label: 'has 3 or more vowels',
    matches: (w) => w.length >= 4 && vowelCount(w) >= 3,
    weight: 2,
  },
]

// ───────── Aggregated base-rule pool ─────────
export const BASE_RULES = [
  ...suffixRules,
  ...containsRules,
  ...startsRules,
  ...specialRules,
]

/** Map of id → rule for easy lookup. */
export const RULES_BY_ID = Object.fromEntries(BASE_RULES.map((r) => [r.id, r]))

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
    label: 'contains a double letter',
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
    label: 'has 3 or more vowels',
    matches: (w) => vowelCount(w) >= 3,
    weight: 2,
  },
]

// ───────── Helpers ─────────

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
