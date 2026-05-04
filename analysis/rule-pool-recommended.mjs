// Curated subset analysis — only the proposed rules that pulled their
// weight in rule-pool-analysis.mjs (≥3 viable pairs each), plus the
// high-leverage length/letter-set rules.
//
// Run from snibble repo root: node analysis/rule-pool-recommended.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMMON_PATH = resolve(__dirname, '../public/common-words.txt')

const MIN_PAIR_INTERSECTION = 30
const MAX_PAIR_OVERLAP_RATIO = 0.7

const VOWELS = new Set(['A','E','I','O','U'])
const isVowel = (c) => VOWELS.has(c)
const vowelCount = (w) => { let n = 0; for (const c of w) if (isVowel(c)) n++; return n }
const hasDoubleLetter = (w) => { for (let i=1;i<w.length;i++) if (w[i]===w[i-1]) return true; return false }

// Existing 43 rules
const SUFFIXES = ['OW','AT','IN','OG','EN','ED','ER','ING','LY','EAR','ICK','ALL','EST','OOK','ARK','EE','Y','IGHT','ATE','ION']
const CONTAINS = ['OO','EA','OU','EE','CH','SH','TH','AI','OA','ST']
const STARTS = ['B','S','F','M','TH','PR','CH','BR','ST','TR']

const existing = [
  ...SUFFIXES.map(s => ({ id:`suffix:${s}`, family:'suffix', label:`end in -${s}`, matches:(w)=>w.length>=3 && w.endsWith(s) })),
  ...CONTAINS.map(s => ({ id:`contains:${s}`, family:'contains', label:`contain -${s}-`, matches:(w)=>w.length>=3 && w.includes(s) })),
  ...STARTS.map(s => ({ id:`starts:${s}`, family:'starts', label:`start with ${s}-`, matches:(w)=>w.length>=3 && w.startsWith(s) })),
  { id:'special:double-letter', family:'special', label:'contain a double letter', matches:(w)=>w.length>=3 && hasDoubleLetter(w) },
  { id:'special:vowel-rich', family:'special', label:'have 3+ vowels', matches:(w)=>w.length>=4 && vowelCount(w)>=3 },
  { id:'special:ends-vowel', family:'special', label:'end in a vowel', matches:(w)=>w.length>=3 && isVowel(w[w.length-1]) },
]

// ── RECOMMENDED ADDITIONS ──

// 4-letter suffixes that DO pull their weight (≥1 pair, broad enough)
const NEW_SUFFIXES_LONG = ['TION','ABLE','MENT','NESS','LESS']
// 3-letter suffixes that contributed pairs
const NEW_SUFFIXES_SHORT = ['ITE','ORE','AIN','ICE']
// 3-letter contains — all contributed solidly
const NEW_CONTAINS = ['OUN','EAR','OUR','INE','ACK','ILL','ANG','ONG','UNG','IGH','OUS','TCH','NGE','RGE']
// 2-letter prefixes — all contributed solidly
const NEW_STARTS_2L = ['BL','CL','FL','GL','PL','SL','CR','DR','FR','GR','SC','SK','SM','SN','SP','SW','UN','RE','DE']

const NEW_SPECIAL = [
  { id:'length:exact-5', family:'length', label:'exactly 5 letters', matches:(w)=>w.length===5 },
  { id:'length:exact-6', family:'length', label:'exactly 6 letters', matches:(w)=>w.length===6 },
  { id:'length:7-plus', family:'length', label:'7+ letters', matches:(w)=>w.length>=7 },
  { id:'letterset:one-vowel', family:'letterset', label:'has exactly one vowel', matches:(w)=>w.length>=3 && vowelCount(w)===1 },
  { id:'letterset:no-e', family:'letterset', label:'contains no E', matches:(w)=>w.length>=3 && !w.includes('E') },
  { id:'letterset:has-y', family:'letterset', label:'contains a Y', matches:(w)=>w.length>=3 && w.includes('Y') },
  { id:'pattern:ends-2-consonants', family:'pattern', label:'ends with two consonants', matches:(w)=>w.length>=3 && !isVowel(w[w.length-1]) && !isVowel(w[w.length-2]) },
  { id:'pattern:starts-2-consonants', family:'pattern', label:'starts with two consonants', matches:(w)=>w.length>=3 && !isVowel(w[0]) && !isVowel(w[1]) },
]

const proposed = [
  ...NEW_SUFFIXES_LONG.map(s => ({ id:`suffix:${s}`, family:'suffix', label:`end in -${s}`, matches:(w)=>w.length>=s.length+1 && w.endsWith(s) })),
  ...NEW_SUFFIXES_SHORT.map(s => ({ id:`suffix:${s}`, family:'suffix', label:`end in -${s}`, matches:(w)=>w.length>=4 && w.endsWith(s) })),
  ...NEW_CONTAINS.map(s => ({ id:`contains:${s}`, family:'contains', label:`contain -${s}-`, matches:(w)=>w.length>=3 && w.includes(s) })),
  ...NEW_STARTS_2L.map(s => ({ id:`starts:${s}`, family:'starts', label:`start with ${s}-`, matches:(w)=>w.length>=3 && w.startsWith(s) })),
  ...NEW_SPECIAL,
]

// Redundancy logic (mirrors rules.js)
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
  const sub = (r) => (r.family === 'contains' ? part(r) : null)
  const aff = (r) => (r.family === 'starts' || r.family === 'suffix' ? part(r) : null)
  if (sub(a) && aff(b) && aff(b).includes(sub(a))) return true
  if (sub(b) && aff(a) && aff(a).includes(sub(b))) return true
  if (a.family==='starts' && b.family==='contains' && part(b)[0]===part(a)[0]) return true
  if (b.family==='starts' && a.family==='contains' && part(a)[0]===part(b)[0]) return true
  if (a.family==='suffix' && b.family==='contains') {
    const pa=part(a), pb=part(b)
    if (pa.length && pb.length && pb[pb.length-1]===pa[pa.length-1]) return true
  }
  if (b.family==='suffix' && a.family==='contains') {
    const pa=part(a), pb=part(b)
    if (pa.length && pb.length && pa[pa.length-1]===pb[pb.length-1]) return true
  }
  return false
}

const commonWords = readFileSync(COMMON_PATH, 'utf8').split('\n').map(w=>w.trim().toUpperCase()).filter(Boolean)

function buildMatchSets(rules) {
  const m = new Map()
  for (const r of rules) {
    const set = new Set()
    for (const w of commonWords) if (r.matches(w)) set.add(w)
    m.set(r.id, set)
  }
  return m
}
function countViablePairs(rules, matchSets) {
  const pairs = []
  for (let i=0;i<rules.length;i++) for (let j=i+1;j<rules.length;j++) {
    const a=rules[i], b=rules[j]
    if (a.family===b.family) continue
    if (rulesAreRedundant(a,b)) continue
    const aS=matchSets.get(a.id), bS=matchSets.get(b.id)
    let inter=0
    for (const w of aS) if (bS.has(w)) inter++
    if (inter < MIN_PAIR_INTERSECTION) continue
    const smaller = Math.min(aS.size, bS.size)
    if (smaller > 0 && inter/smaller > MAX_PAIR_OVERLAP_RATIO) continue
    pairs.push({ a:a.id, b:b.id, inter })
  }
  return pairs
}

const baselineMS = buildMatchSets(existing)
const baselinePairs = countViablePairs(existing, baselineMS)
const ALL = [...existing, ...proposed]
const allMS = buildMatchSets(ALL)
const allPairs = countViablePairs(ALL, allMS)

console.log(`Common words: ${commonWords.length}\n`)
console.log('=== RECOMMENDED ADDITIONS ===')
console.log(`Existing rules:           ${existing.length}`)
console.log(`Proposed additions:       ${proposed.length}`)
console.log(`Total rules:              ${ALL.length}`)
console.log()
console.log(`Baseline viable pairs:    ${baselinePairs.length}`)
console.log(`Expanded viable pairs:    ${allPairs.length}  (+${allPairs.length - baselinePairs.length}, ${((allPairs.length/baselinePairs.length-1)*100).toFixed(0)}% increase)`)
const interSorted = allPairs.map(p=>p.inter).sort((a,b)=>a-b)
console.log(`Intersection sizes:       min ${interSorted[0]}, median ${interSorted[Math.floor(interSorted.length/2)]}, max ${interSorted[interSorted.length-1]}`)
console.log()

console.log('=== Per-proposed-rule pair contribution ===')
for (const r of proposed) {
  const mc = allMS.get(r.id).size
  const pc = allPairs.filter(p => p.a===r.id || p.b===r.id).length
  console.log(`${r.label.padEnd(36)} matches=${String(mc).padStart(5)}  pairs=${String(pc).padStart(3)}`)
}

function repeatProb(N, n) {
  let p=1; for (let k=0;k<n;k++) p*=(1-k/N); return 1-p
}
console.log()
console.log('=== Repeat probability (uniform draws) ===')
console.log(`5 matches:   baseline ${(repeatProb(baselinePairs.length,5)*100).toFixed(2)}%  →  expanded ${(repeatProb(allPairs.length,5)*100).toFixed(2)}%`)
console.log(`10 matches:  baseline ${(repeatProb(baselinePairs.length,10)*100).toFixed(2)}%  →  expanded ${(repeatProb(allPairs.length,10)*100).toFixed(2)}%`)
console.log(`20 matches:  baseline ${(repeatProb(baselinePairs.length,20)*100).toFixed(2)}%  →  expanded ${(repeatProb(allPairs.length,20)*100).toFixed(2)}%`)
