#!/usr/bin/env node
/**
 * Craving-rule health check, run against the REAL rule pool — no local
 * copies of rule definitions, so this can't drift from rules.js.
 *
 *   node scripts/measure-candidate-rules.mjs [sharedSeeds]
 *   ISO_SEEDS=40 node scripts/measure-candidate-rules.mjs 120
 *
 * Why this exists: cravingGenerator rejects any tray whose common-word
 * solution count falls outside 12..30, or whose full-TWL pool exceeds
 * FULL_DICT_CAP. A rule that is too BROAD or too NARROW does not throw —
 * it silently loses every attempt and never appears in the game. So
 * "does this rule actually work" can only be answered empirically.
 *
 * Three passes:
 *   1. Retirement guards — the exact-length rules must be OUT of the
 *      sampling pool but still resolvable by id (stored puzzles and
 *      in-flight match rounds look them up).
 *   2. Isolation — each rule alone in the pool, so weightedPick must
 *      return it and the whole 150-attempt budget is spent on it. This
 *      is the pass that decides viability. A rule's win count in the
 *      SHARED pool cannot: at weight 3 in a ~95-rule pool the expected
 *      share is about 1 day in 120, so a zero there is noise.
 *   3. Shared pool — context only. Confirms the generator never
 *      hard-fails and that variety is healthy.
 *
 * Written 2026-07-30 alongside retiring length:exact-5 / exact-6 and
 * adding the shape + vowelset families.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const SHARED_SEEDS = Number(process.argv[2] ?? 120)
const ISO_SEEDS = Number(process.env.ISO_SEEDS ?? 40)
const START = '2026-08-01'

// Node has no import.meta.env / fetch path for the word lists; the
// generator reads these globals when present. Same trick the other
// verify scripts use.
const wordsText = await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText.split('\n').map((w) => w.trim()).filter(Boolean)
const commonText = await fs.readFile(path.join(repoRoot, 'public/common-words.txt'), 'utf-8')
globalThis.__SNIBBLE_COMMON_WORDS__ = commonText.split('\n').map((w) => w.trim()).filter(Boolean)

const { BASE_RULES, RULES_BY_ID, RETIRED_RULES } = await import('../src/lib/rules.js')
const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')
const { dailySeedForIso } = await import('../src/lib/rng.js')

const MIN_WORD_LENGTH = 4   // mirrors cravingGenerator's own floor
const FULL_POOL = [...BASE_RULES]
// The families added 2026-07-30. Everything else is long-shipped.
const NEW_FAMILIES = new Set(['shape', 'vowelset'])
const NEW_RULES = FULL_POOL.filter((r) => NEW_FAMILIES.has(r.family))

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** Swap the sampling pool. BASE_RULES is an exported const ARRAY, so it
 *  can be mutated in place and the generator sees the change. */
function setPool(rules) {
  BASE_RULES.length = 0
  BASE_RULES.push(...rules)
}

let failed = 0
const fail = (msg) => { console.log(`  FAIL ${msg}`); failed++ }
const pass = (msg) => console.log(`  ok   ${msg}`)

// ── 1. Retirement guards ──────────────────────────────────────
console.log('retirement guards')
for (const r of RETIRED_RULES) {
  if (FULL_POOL.some((p) => p.id === r.id)) fail(`${r.id} is still in BASE_RULES`)
  else pass(`${r.id} is out of the sampling pool`)

  if (!RULES_BY_ID[r.id]) fail(`${r.id} is not resolvable via RULES_BY_ID (stored puzzles would lose their craving)`)
  else pass(`${r.id} still resolves by id`)
}
// weightedPick does `it.weight || 1`, so a 0 weight would silently
// become 1. Retired rules must simply be absent, not zero-weighted.
for (const r of FULL_POOL) {
  if (r.weight === 0) fail(`${r.id} has weight 0, which weightedPick reads as 1`)
}

// ── Anchor pools ──────────────────────────────────────────────
const common = globalThis.__SNIBBLE_COMMON_WORDS__.filter((w) => w.length >= MIN_WORD_LENGTH)
console.log(`\ndictionary: ${globalThis.__SNIBBLE_DICTIONARY__.length} words, `
  + `${common.length} common at ${MIN_WORD_LENGTH}+ letters`)
console.log(`pool: ${FULL_POOL.length} rules, ${NEW_RULES.length} in the new families `
  + `(${[...NEW_FAMILIES].join(', ')})`)

const anchors = new Map()
for (const r of NEW_RULES) anchors.set(r.id, common.filter((w) => r.matches(w)).length)

// ── 2. Isolation run — the verdict ────────────────────────────
console.log(`\nisolation run - each new rule alone in the pool, ${ISO_SEEDS} seeds each`)
console.log('  rule                             anchors  ok/N   avg sol  avg tries  verdict')
const samples = new Map()
for (const r of NEW_RULES) {
  setPool([r])
  let ok = 0, totalSol = 0, totalTries = 0
  for (let i = 0; i < ISO_SEEDS; i++) {
    const iso = addDays(START, i)
    try {
      const p = await generatePuzzle(dailySeedForIso(iso))
      ok++; totalSol += p.totalSolutions; totalTries += p.attempt
      if (!samples.has(r.id)) {
        samples.set(r.id, {
          iso, total: p.totalSolutions, difficulty: p.difficulty,
          letters: p.letters.join(''), words: p.sampleSolutions.slice(0, 6),
        })
      }
    } catch { /* exhausted the attempt budget — a miss */ }
  }

  const a = anchors.get(r.id)
  const rate = ok / ISO_SEEDS
  const avgSol = ok ? (totalSol / ok).toFixed(1) : '-'
  const avgTries = ok ? (totalTries / ok).toFixed(1) : '-'

  let verdict = 'works'
  if (a < 12) { verdict = 'UNUSABLE - anchor pool below the floor'; failed++ }
  else if (ok === 0) { verdict = 'UNUSABLE - no tray ever lands in band'; failed++ }
  else if (rate < 0.9) { verdict = `marginal - fails ${((1 - rate) * 100).toFixed(0)}% of seeds` }

  console.log(
    `  ${r.id.padEnd(32)} ${String(a).padStart(6)} ${String(ok).padStart(3)}/${ISO_SEEDS}`
    + `  ${String(avgSol).padStart(7)}  ${String(avgTries).padStart(9)}  ${verdict}`
  )
}

// ── 3. Shared pool — context + hard-fail guard ────────────────
setPool(FULL_POOL)
console.log(`\nshared pool - ${SHARED_SEEDS} consecutive daily seeds from ${START}`)
const wins = new Map()
let hardFails = 0, retiredSeen = 0
const t0 = Date.now()
for (let i = 0; i < SHARED_SEEDS; i++) {
  try {
    const p = await generatePuzzle(dailySeedForIso(addDays(START, i)))
    wins.set(p.base.id, (wins.get(p.base.id) ?? 0) + 1)
    if (RETIRED_RULES.some((r) => r.id === p.base.id)) retiredSeen++
  } catch { hardFails++ }
}
const newShare = NEW_RULES.reduce((s, r) => s + (wins.get(r.id) ?? 0), 0)
console.log(`  ran in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log(`  distinct rules used : ${wins.size}`)
console.log(`  new-family share    : ${newShare}/${SHARED_SEEDS} days `
  + `(${((newShare / SHARED_SEEDS) * 100).toFixed(0)}%)`)
if (hardFails > 0) fail(`${hardFails} seed(s) exhausted the attempt budget`)
else pass('no generator hard-fails')
if (retiredSeen > 0) fail(`a retired rule was picked ${retiredSeen}x`)
else pass('no retired rule was ever picked')

// ── Samples ───────────────────────────────────────────────────
console.log('\nsample day per new rule')
for (const r of NEW_RULES) {
  const s = samples.get(r.id)
  if (!s) continue
  console.log(`\n  ${r.craving}`)
  console.log(`    ${s.iso} | tray ${s.letters} | ${s.total} solutions | `
    + '*'.repeat(s.difficulty) + '.'.repeat(3 - s.difficulty))
  console.log(`    ${s.words.join(', ')}`)
}

console.log(failed === 0 ? '\nall checks passed.' : `\n${failed} check(s) FAILED.`)
process.exitCode = failed === 0 ? 0 : 1
