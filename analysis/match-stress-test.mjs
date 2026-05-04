// Stress test the match-mode generator across many seeds. Confirms:
//   1. No seed throws (all produce valid puzzles)
//   2. New rules show up in selection
//   3. excludePairKeys correctly filters out unwanted pairs
//   4. With dedup, no two matches in a 15-window repeat

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
globalThis.__SNIBBLE_DICTIONARY__ = (await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8'))
  .split('\n').map(w=>w.trim()).filter(Boolean)
globalThis.__SNIBBLE_COMMON_WORDS__ = (await fs.readFile(path.join(repoRoot, 'public/common-words.txt'), 'utf-8'))
  .split('\n').map(w=>w.trim()).filter(Boolean)

const { generateMatchPuzzle, rulePairKey } = await import('../src/lib/cravingGenerator.js')

const N = 100
const pairCounts = new Map()
const newFamilyHits = { length: 0, letterset: 0, pattern: 0, suffix4: 0, contains3: 0, starts2: 0 }
let failures = 0

for (let i = 0; i < N; i++) {
  try {
    const p = await generateMatchPuzzle(`snibble:match:stress-${i}`)
    const key = rulePairKey(p.base.ids)
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
    for (const id of p.base.ids) {
      if (id.startsWith('length:')) newFamilyHits.length++
      else if (id.startsWith('letterset:')) newFamilyHits.letterset++
      else if (id.startsWith('pattern:')) newFamilyHits.pattern++
      else if (id.startsWith('suffix:') && id.length > 'suffix:XXX'.length) newFamilyHits.suffix4++
      else if (id.startsWith('contains:') && id.length > 'contains:XX'.length) newFamilyHits.contains3++
      else if (id.startsWith('starts:') && id.length > 'starts:X'.length) newFamilyHits.starts2++
    }
  } catch (e) {
    failures++
    console.error(`Seed ${i} failed:`, e.message)
  }
}

console.log(`\nGenerated ${N - failures}/${N} match puzzles.`)
console.log(`Failures: ${failures}`)
console.log(`Distinct pairs picked: ${pairCounts.size}`)
console.log(`New-family rule appearances: ${JSON.stringify(newFamilyHits)}`)

// Most-picked pairs (sanity check no single pair dominates)
const top = [...pairCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 5)
console.log('Top 5 pairs by frequency:')
for (const [k,c] of top) console.log(`  ${c}x  ${k}`)

// Exclusion test: pick a frequent pair, exclude it, verify it's not chosen
const excludeKey = top[0][0]
const exclude = new Set([excludeKey])
let excluded = 0
for (let i = 0; i < 50; i++) {
  const p = await generateMatchPuzzle(`snibble:match:exclude-test-${i}`, { excludePairKeys: exclude })
  if (rulePairKey(p.base.ids) === excludeKey) excluded++
}
console.log(`\nExclusion test: 50 seeds with "${excludeKey}" excluded — hit it ${excluded} times (should be 0).`)

// Sliding-window dedup simulation: 30 matches in a row, dedup against last 15
console.log('\nSliding-window simulation (30 matches, dedup last 15):')
const recent = []
const seen = new Map()
for (let i = 0; i < 30; i++) {
  const exc = new Set(recent)
  const p = await generateMatchPuzzle(`snibble:match:sliding-${i}`, { excludePairKeys: exc })
  const k = rulePairKey(p.base.ids)
  seen.set(k, (seen.get(k) || 0) + 1)
  recent.push(k)
  if (recent.length > 15) recent.shift()
}
const repeats = [...seen.entries()].filter(([,n])=>n>1)
console.log(`  Distinct pairs in 30: ${seen.size}`)
console.log(`  Repeated pairs: ${repeats.length}  (expected 0 within 15-window, possibly some at distance >15)`)
for (const [k,n] of repeats) console.log(`    ${n}x  ${k}`)
