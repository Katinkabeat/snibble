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
const SUFFIXES = [
  // Common, friendly
  { suffix: 'OW',   weight: 3 },
  { suffix: 'AT',   weight: 3 },
  { suffix: 'IN',   weight: 3 },
  { suffix: 'OG',   weight: 3 },
  { suffix: 'EN',   weight: 3 },
  { suffix: 'ED',   weight: 3, minWordLen: 4 }, // skip "ED" alone
  { suffix: 'ER',   weight: 3, minWordLen: 4 },
  { suffix: 'ING',  weight: 3 },
  { suffix: 'LY',   weight: 2, minWordLen: 4 },
  { suffix: 'EAR',  weight: 2 },
  { suffix: 'ICK',  weight: 2 },
  { suffix: 'ALL',  weight: 2 },
  { suffix: 'EST',  weight: 2 },
  { suffix: 'OOK',  weight: 2 },
  { suffix: 'ARK',  weight: 2 },
  { suffix: 'EE',   weight: 2 },
  { suffix: 'Y',    weight: 2, minWordLen: 3 },
  // Slightly trickier
  { suffix: 'IGHT', weight: 1 },
  { suffix: 'ATE',  weight: 1 },
  { suffix: 'ION',  weight: 1 },
  // Long suffixes — naturally narrow, recognizable shapes
  { suffix: 'TION', weight: 2, minWordLen: 5 },
  { suffix: 'ABLE', weight: 2, minWordLen: 5 },
  { suffix: 'MENT', weight: 1, minWordLen: 5 },
  { suffix: 'NESS', weight: 1, minWordLen: 5 },
  { suffix: 'LESS', weight: 1, minWordLen: 5 },
  // 3-letter suffixes filling gaps
  { suffix: 'ITE',  weight: 2, minWordLen: 4 },
  { suffix: 'ORE',  weight: 2, minWordLen: 4 },
  { suffix: 'AIN',  weight: 2, minWordLen: 4 },
  { suffix: 'ICE',  weight: 2, minWordLen: 4 },
]

const suffixRules = SUFFIXES.map(({ suffix, weight, minWordLen = 3 }) => ({
  id: `suffix:${suffix}`,
  family: 'suffix',
  label: `end in -${suffix}`,
  matches: (w) => w.length >= minWordLen && w.endsWith(suffix),
  weight,
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
  { sub: 'UNG', weight: 2 },
  { sub: 'IGH', weight: 3 },
  { sub: 'OUS', weight: 3 },
  { sub: 'TCH', weight: 2 },
  { sub: 'NGE', weight: 2 },
  { sub: 'RGE', weight: 2 },
]

const containsRules = CONTAINS.map(({ sub, weight }) => ({
  id: `contains:${sub}`,
  family: 'contains',
  label: `contain -${sub}-`,
  matches: (w) => w.length >= 3 && w.includes(sub),
  weight,
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
    matches: (w) => w.length >= 3 && hasDoubleLetter(w),
    weight: 8,
  },
  {
    id: 'special:vowel-rich',
    family: 'special',
    label: 'have 3 or more vowels',
    matches: (w) => w.length >= 4 && vowelCount(w) >= 3,
    weight: 6,
  },
  {
    id: 'special:ends-vowel',
    family: 'special',
    label: 'end in a vowel',
    matches: (w) => w.length >= 3 && isVowel(w[w.length - 1]),
    weight: 5,
  },
]

// ───────── Length rules ─────────
// Word-length buckets — slice the dictionary cleanly and pair well
// with most other families. Highest leverage of any single addition.
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
    label: '7 or more letters',
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

// ───────── Pattern rules ─────────
// Letter shape constraints at word boundaries.
const patternRules = [
  {
    id: 'pattern:ends-2-consonants',
    family: 'pattern',
    label: 'ends with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[w.length - 1]) && !isVowel(w[w.length - 2]),
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

// ───────── Aggregated base-rule pool ─────────
export const BASE_RULES = [
  ...suffixRules,
  ...containsRules,
  ...startsRules,
  ...specialRules,
  ...lengthRules,
  ...lettersetRules,
  ...patternRules,
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
