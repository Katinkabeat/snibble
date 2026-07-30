#!/usr/bin/env node
/**
 * Verifies the 2026-07-30 rule change against the REAL stored puzzles.
 *
 *   node scripts/verify-rule-retirement.mjs
 *
 * Two things this proves, neither of which needs a browser or a dev
 * server (Rae's standing rule: she starts dev servers, not Claude).
 *
 * 1. RETIREMENT IS SAFE. sn_daily_puzzles pins each past day's rule by
 *    id, and GameView resolves it with RULES_BY_ID[puzzle.base.id] then
 *    calls baseRule.matches(word) on every feed. Today's live puzzle
 *    (2026-07-30) is length:exact-5 — one of the retired rules. Had they
 *    been deleted rather than retired, baseRule would be undefined and
 *    every feed today would throw. So each stored id must still resolve
 *    to a rule with a WORKING matcher, not just a label.
 *
 * 2. THE c304 FOLD-IN WAS NECESSARY. StatsPage used to reconstruct a
 *    past day's craving by re-running the generator on that day's seed.
 *    weightedPick samples the whole pool, so changing the pool changes
 *    what every historical seed produces. This compares stored rule vs
 *    regenerated rule for the last N days: any mismatch is a day the old
 *    code would now mislabel.
 *
 * Date list is passed in (piped from psql) so this script needs no DB
 * driver. See the command in the session log.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const listPath = process.argv[2]
if (!listPath) {
  console.error('usage: node scripts/verify-rule-retirement.mjs <stored-puzzles.txt>')
  console.error('file format, one per line: YYYY-MM-DD|rule:id|difficulty')
  process.exit(2)
}

const wordsText = await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText.split('\n').map((w) => w.trim()).filter(Boolean)
const commonText = await fs.readFile(path.join(repoRoot, 'public/common-words.txt'), 'utf-8')
globalThis.__SNIBBLE_COMMON_WORDS__ = commonText.split('\n').map((w) => w.trim()).filter(Boolean)

const { RULES_BY_ID, BASE_RULES, RETIRED_RULES } = await import('../src/lib/rules.js')
const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')
const { dailySeedForIso } = await import('../src/lib/rng.js')

const rows = (await fs.readFile(listPath, 'utf-8'))
  .split('\n').map((l) => l.trim()).filter(Boolean)
  .map((l) => { const [date, ruleId, difficulty] = l.split('|'); return { date, ruleId, difficulty } })

let failed = 0
const fail = (m) => { console.log(`  FAIL ${m}`); failed++ }

// ── 1. Every stored rule id still resolves, with a live matcher ──
console.log(`stored-puzzle resolution (${rows.length} days)\n`)
console.log('  date        stored rule            retired?  resolves  matcher  craving')
for (const { date, ruleId } of rows) {
  const rule = RULES_BY_ID[ruleId]
  const isRetired = RETIRED_RULES.some((r) => r.id === ruleId)
  const resolves = !!rule
  const hasMatcher = typeof rule?.matches === 'function'

  if (!resolves) fail(`${date}: stored rule ${ruleId} does not resolve — craving would render blank`)
  else if (!hasMatcher) fail(`${date}: ${ruleId} resolves but has no matches() — feeds would throw`)

  console.log(
    `  ${date}  ${ruleId.padEnd(22)} ${(isRetired ? 'RETIRED' : '-').padEnd(9)}`
    + ` ${(resolves ? 'yes' : 'NO').padEnd(9)}${(hasMatcher ? 'yes' : 'NO').padEnd(9)}`
    + `${rule?.craving ?? '(none)'}`
  )
}

// Exercise a retired matcher for real, the way GameView does.
console.log('\nretired matchers still work (the check that keeps today playable)')
for (const r of RETIRED_RULES) {
  const rule = RULES_BY_ID[r.id]
  const probe = r.id === 'length:exact-5' ? ['GROWS', 'GROW'] : ['GROWTH', 'GROW']
  const [should, shouldNot] = probe
  const ok = rule.matches(should) === true && rule.matches(shouldNot) === false
  if (!ok) fail(`${r.id} matcher misbehaved on ${should}/${shouldNot}`)
  console.log(`  ${r.id.padEnd(22)} matches(${should})=${rule.matches(should)} `
    + `matches(${shouldNot})=${rule.matches(shouldNot)}  ${ok ? 'ok' : 'FAIL'}`)
}

// ── 2. Stored vs regenerated — why StatsPage had to stop guessing ──
console.log('\nstored rule vs what regeneration NOW produces')
console.log('  (every mismatch is a day the pre-fix StatsPage would mislabel)\n')
console.log('  date        stored                 regenerated            match')
let drift = 0
for (const { date, ruleId } of rows) {
  let regenId = '(threw)'
  try {
    const p = await generatePuzzle(dailySeedForIso(date))
    regenId = p.base.id
  } catch { /* leave as threw */ }
  const same = regenId === ruleId
  if (!same) drift++
  console.log(`  ${date}  ${ruleId.padEnd(22)} ${regenId.padEnd(22)} ${same ? 'same' : 'DRIFTED'}`)
}

console.log(`\n  ${drift}/${rows.length} days drifted.`)
if (drift === 0) {
  console.log('  NOTE: zero drift is suspicious here — the pool changed, so some')
  console.log('  drift is expected. Check that the rule change is actually loaded.')
} else {
  console.log('  StatsPage now reads the stored row, so these render correctly.')
}

console.log(`\npool: ${BASE_RULES.length} sampling rules, `
  + `${RETIRED_RULES.length} retired but resolvable`)
console.log(failed === 0 ? '\nall checks passed.' : `\n${failed} check(s) FAILED.`)
process.exitCode = failed === 0 ? 0 : 1
