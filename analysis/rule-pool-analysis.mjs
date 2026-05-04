// Standalone analysis: how many viable rule pairs do we have today,
// and how does the pool grow if we add a batch of narrow rules?
//
// Mirrors the logic in src/lib/cravingGenerator.js exactly:
//   - common-word match set per rule
//   - skip same-family pairs
//   - skip redundant pairs (same logic as rules.js#rulesAreRedundant)
//   - intersection >= MIN_PAIR_INTERSECTION (30)
//   - intersection / smaller-set <= MAX_PAIR_OVERLAP_RATIO (0.7)
//
// Run from snibble repo root: node analysis/rule-pool-analysis.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMMON_PATH = resolve(__dirname, '../public/common-words.txt')

const MIN_PAIR_INTERSECTION = 30
const MAX_PAIR_OVERLAP_RATIO = 0.7

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])
const isVowel = (c) => VOWELS.has(c)
const vowelCount = (w) => { let n = 0; for (const c of w) if (isVowel(c)) n++; return n }
const hasDoubleLetter = (w) => { for (let i = 1; i < w.length; i++) if (w[i] === w[i-1]) return true; return false }
const consonantCount = (w) => w.length - vowelCount(w)

// ──────────────────── Existing rules (mirrored from rules.js) ────────────────────

const SUFFIXES = [
  'OW','AT','IN','OG','EN','ED','ER','ING','LY','EAR','ICK','ALL','EST','OOK','ARK','EE','Y','IGHT','ATE','ION',
]
const CONTAINS = ['OO','EA','OU','EE','CH','SH','TH','AI','OA','ST']
const STARTS = ['B','S','F','M','TH','PR','CH','BR','ST','TR']

const existingSuffix = SUFFIXES.map((s) => ({
  id: `suffix:${s}`, family: 'suffix', label: `end in -${s}`,
  matches: (w) => w.length >= 3 && w.endsWith(s),
}))
const existingContains = CONTAINS.map((s) => ({
  id: `contains:${s}`, family: 'contains', label: `contain -${s}-`,
  matches: (w) => w.length >= 3 && w.includes(s),
}))
const existingStarts = STARTS.map((s) => ({
  id: `starts:${s}`, family: 'starts', label: `start with ${s}-`,
  matches: (w) => w.length >= 3 && w.startsWith(s),
}))
const existingSpecial = [
  { id: 'special:double-letter', family: 'special', label: 'contain a double letter',
    matches: (w) => w.length >= 3 && hasDoubleLetter(w) },
  { id: 'special:vowel-rich', family: 'special', label: 'have 3+ vowels',
    matches: (w) => w.length >= 4 && vowelCount(w) >= 3 },
  { id: 'special:ends-vowel', family: 'special', label: 'end in a vowel',
    matches: (w) => w.length >= 3 && isVowel(w[w.length-1]) },
]

const EXISTING = [...existingSuffix, ...existingContains, ...existingStarts, ...existingSpecial]

// ──────────────────── Proposed new rules ────────────────────
// Goal: each rule should be NARROW (matches a few hundred common words at most),
// so AND-intersections with other rules stay in the same "12-30 puzzle solutions" sweet spot.

const PROPOSED_SUFFIXES = [
  // 4-letter suffixes — naturally narrow
  'OWN','OUND','ATCH','OUGH','ANCE','ENCE','TION','ABLE','MENT','NESS','LESS','FULL','SHIP','HOOD','WARD','SIDE',
  // Other 3-letter suffixes filling gaps
  'AKE','ITE','ORE','UCK','ELL','ILL','ASH','USH','OOL','OON','AIN','OAT','EAT','ICE','UMP','UNK',
]
const PROPOSED_CONTAINS = [
  // 3-letter substrings — narrower than 2-letter
  'OUN','EAR','OUR','INE','ACK','ILL','ANG','ONG','UNG','IGH','OUL','OUS','TCH','NGE','RGE','LDE',
]
const PROPOSED_STARTS = [
  // 2-letter prefixes filling gaps
  'BL','CL','FL','GL','PL','SL','CR','DR','FR','GR','SC','SK','SM','SN','SP','SW','TW','UN','RE','DE',
  // Single-letter prefixes not currently covered
  'C','D','G','H','L','P','R','T','W',
]
const PROPOSED_SPECIAL = [
  { id: 'special:exact-len-5', family: 'length', label: 'exactly 5 letters',
    matches: (w) => w.length === 5 },
  { id: 'special:exact-len-6', family: 'length', label: 'exactly 6 letters',
    matches: (w) => w.length === 6 },
  { id: 'special:len-7-plus', family: 'length', label: '7+ letters',
    matches: (w) => w.length >= 7 },
  { id: 'special:one-vowel', family: 'special2', label: 'has exactly one vowel',
    matches: (w) => w.length >= 3 && vowelCount(w) === 1 },
  { id: 'special:no-e', family: 'special2', label: 'contains no E',
    matches: (w) => w.length >= 3 && !w.includes('E') },
  { id: 'special:has-y', family: 'special2', label: 'contains a Y',
    matches: (w) => w.length >= 3 && w.includes('Y') },
  { id: 'special:double-consonant-cluster', family: 'special2', label: 'ends with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[w.length-1]) && !isVowel(w[w.length-2]) },
  { id: 'special:starts-double-consonant', family: 'special2', label: 'starts with two consonants',
    matches: (w) => w.length >= 3 && !isVowel(w[0]) && !isVowel(w[1]) },
  { id: 'special:vowel-heavy', family: 'special2', label: 'half-or-more letters are vowels',
    matches: (w) => w.length >= 4 && vowelCount(w) * 2 >= w.length },
]

const proposedSuffix = PROPOSED_SUFFIXES.map((s) => ({
  id: `suffix:${s}`, family: 'suffix', label: `end in -${s}`,
  matches: (w) => w.length >= Math.max(3, s.length + 1) && w.endsWith(s),
}))
const proposedContains = PROPOSED_CONTAINS.map((s) => ({
  id: `contains:${s}`, family: 'contains', label: `contain -${s}-`,
  matches: (w) => w.length >= 3 && w.includes(s),
}))
const proposedStarts = PROPOSED_STARTS.map((s) => ({
  id: `starts:${s}`, family: 'starts', label: `start with ${s}-`,
  matches: (w) => w.length >= 3 && w.startsWith(s),
}))

const PROPOSED = [...proposedSuffix, ...proposedContains, ...proposedStarts, ...PROPOSED_SPECIAL]

// ──────────────────── Redundancy logic (mirrors rules.js) ────────────────────

function rulesAreRedundant(a, b) {
  if (a.id === b.id) return true
  const part = (r) => r.id.split(':')[1] || ''
  const isDouble = (s) => s.length >= 2 && /^(.)\1+$/.test(s)
  const endsDouble = (s) => s.length >= 2 && s[s.length-1] === s[s.length-2]
  const guaranteesDouble = (r) => {
    if (r.id === 'special:double-letter') return true
    if (r.family === 'contains' && isDouble(part(r))) return true
    if (r.family === 'suffix' && endsDouble(part(r))) return true
    return false
  }
  if (guaranteesDouble(a) && guaranteesDouble(b)) return true
  const containsSub = (r) => (r.family === 'contains' ? part(r) : null)
  const affix = (r) => (r.family === 'starts' || r.family === 'suffix' ? part(r) : null)
  const aSub = containsSub(a), bSub = containsSub(b)
  const aAffix = affix(a), bAffix = affix(b)
  if (aSub && bAffix && bAffix.includes(aSub)) return true
  if (bSub && aAffix && aAffix.includes(bSub)) return true
  if (a.family === 'starts' && b.family === 'contains' && part(b)[0] === part(a)[0]) return true
  if (b.family === 'starts' && a.family === 'contains' && part(a)[0] === part(b)[0]) return true
  if (a.family === 'suffix' && b.family === 'contains') {
    const pa = part(a), pb = part(b)
    if (pa.length && pb.length && pb[pb.length-1] === pa[pa.length-1]) return true
  }
  if (b.family === 'suffix' && a.family === 'contains') {
    const pa = part(a), pb = part(b)
    if (pa.length && pb.length && pa[pa.length-1] === pb[pb.length-1]) return true
  }
  return false
}

// ──────────────────── Analysis ────────────────────

const commonWords = readFileSync(COMMON_PATH, 'utf8')
  .split('\n').map((w) => w.trim().toUpperCase()).filter(Boolean)

console.log(`Loaded ${commonWords.length} common words.\n`)

function buildMatchSets(rules) {
  const m = new Map()
  for (const r of rules) {
    const set = new Set()
    for (const w of commonWords) if (r.matches(w)) set.add(w)
    m.set(r.id, set)
  }
  return m
}

function countViablePairs(rules, matchSets, label) {
  const pairs = []
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i], b = rules[j]
      if (a.family === b.family) continue
      if (rulesAreRedundant(a, b)) continue
      const aS = matchSets.get(a.id), bS = matchSets.get(b.id)
      let inter = 0
      for (const w of aS) if (bS.has(w)) inter++
      if (inter < MIN_PAIR_INTERSECTION) continue
      const smaller = Math.min(aS.size, bS.size)
      if (smaller > 0 && inter / smaller > MAX_PAIR_OVERLAP_RATIO) continue
      pairs.push({ a: a.id, b: b.id, inter, smaller })
    }
  }
  return pairs
}

// ── Pass 1: Existing rules only (baseline)
const existingMatchSets = buildMatchSets(EXISTING)
const existingPairs = countViablePairs(EXISTING, existingMatchSets, 'existing')

console.log('=== BASELINE (current 43 rules) ===')
console.log(`Total rules:                ${EXISTING.length}`)
console.log(`Viable pairs:               ${existingPairs.length}`)
const interSizes = existingPairs.map(p => p.inter)
console.log(`Intersection size: min ${Math.min(...interSizes)}, max ${Math.max(...interSizes)}, ` +
            `median ${interSizes.sort((a,b)=>a-b)[Math.floor(interSizes.length/2)]}`)
console.log()

// ── Pass 2: Existing + proposed
const ALL = [...EXISTING, ...PROPOSED]
const allMatchSets = buildMatchSets(ALL)
const allPairs = countViablePairs(ALL, allMatchSets, 'expanded')

console.log('=== PROPOSED (existing + new rules) ===')
console.log(`Total rules:                ${ALL.length}  (+${PROPOSED.length})`)
console.log(`Viable pairs:               ${allPairs.length}  (+${allPairs.length - existingPairs.length})`)
const allInter = allPairs.map(p => p.inter).sort((a,b)=>a-b)
console.log(`Intersection size: min ${allInter[0]}, max ${allInter[allInter.length-1]}, ` +
            `median ${allInter[Math.floor(allInter.length/2)]}`)
console.log()

// ── Per-rule diagnostics for proposed rules
console.log('=== PROPOSED RULES — individual word counts & viable-pair contribution ===')
console.log('Rule (label) | matches | viable pairs containing it')
console.log('-'.repeat(80))
for (const r of PROPOSED) {
  const matches = allMatchSets.get(r.id).size
  const pairsWithIt = allPairs.filter(p => p.a === r.id || p.b === r.id).length
  const flag = matches < 50 ? '  [tiny]' : matches > 1500 ? '  [broad]' : ''
  console.log(`${r.label.padEnd(40)} | ${String(matches).padStart(5)} | ${String(pairsWithIt).padStart(3)}${flag}`)
}
console.log()

// ── Repeat probability estimate
function repeatProb(pairCount, matchesAhead) {
  // Probability of seeing the SAME pair at least twice in `matchesAhead` plays
  // assuming uniform draws (slightly worse than weighted, but a useful
  // upper-bound feel).
  // P(no collision) = ∏ (1 - k/N) for k=0..n-1
  let p = 1
  for (let k = 0; k < matchesAhead; k++) p *= (1 - k / pairCount)
  return 1 - p
}
console.log('=== REPEAT PROBABILITY (5 matches, uniform draws) ===')
console.log(`  Current pool (${existingPairs.length} pairs):  ${(repeatProb(existingPairs.length, 5)*100).toFixed(2)}%`)
console.log(`  Expanded pool (${allPairs.length} pairs):  ${(repeatProb(allPairs.length, 5)*100).toFixed(2)}%`)
console.log()
console.log('=== REPEAT PROBABILITY (10 matches) ===')
console.log(`  Current pool: ${(repeatProb(existingPairs.length, 10)*100).toFixed(2)}%`)
console.log(`  Expanded pool: ${(repeatProb(allPairs.length, 10)*100).toFixed(2)}%`)
