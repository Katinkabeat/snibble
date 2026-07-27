#!/usr/bin/env node
/**
 * c304 verification — the leaderboard's craving line.
 *
 * Checks the exact path StatsPage takes (dailySeedForIso on the stepper's
 * ISO date) against the path the game itself takes (dailySeedString on a
 * Date), and prints what the line will read for recent days.
 *
 *   node scripts/verify-c304-craving.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const wordsText = await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText.split('\n').map((w) => w.trim()).filter(Boolean)
const commonText = await fs.readFile(path.join(repoRoot, 'public/common-words.txt'), 'utf-8')
globalThis.__SNIBBLE_COMMON_WORDS__ = commonText.split('\n').map((w) => w.trim()).filter(Boolean)

const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')
const { dailySeedString, dailySeedForIso } = await import('../src/lib/rng.js')

function todayInHalifax() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}
// Same arithmetic StatsPage's stepper uses.
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

let failures = 0
const today = todayInHalifax()

// 1. The two seed paths must agree for today, or the leaderboard would
//    name a different rule than the one players actually fed.
const viaIso = dailySeedForIso(today)
const viaDate = dailySeedString(new Date())
console.log(`seed via ISO  : ${viaIso}`)
console.log(`seed via Date : ${viaDate}`)
if (viaIso !== viaDate) { console.log('✗ MISMATCH'); failures++ } else console.log('✓ match\n')

// 2. What the line will actually read, for the stepper's recent range.
console.log('date       | ★   | craving line')
console.log('-----------+-----+---------------------------------')
for (let i = 0; i < 8; i++) {
  const iso = addDays(today, -i)
  const t0 = Date.now()
  const p = await generatePuzzle(dailySeedForIso(iso))
  const ms = Date.now() - t0
  const text = p.base.craving ?? p.base.label
  const stars = '★'.repeat(p.difficulty) + '☆'.repeat(3 - p.difficulty)
  console.log(`${iso} | ${stars} | craving: ${text}   (${ms}ms)`)
  if (!text || !text.trim()) { console.log('  ✗ empty craving text'); failures++ }
}

// 3. Determinism — same date must give the same rule on every visit.
const a = await generatePuzzle(dailySeedForIso(addDays(today, -3)))
const b = await generatePuzzle(dailySeedForIso(addDays(today, -3)))
console.log(`\ndeterminism (same date twice): ${a.base.id === b.base.id ? '✓ ' + a.base.id : '✗ ' + a.base.id + ' vs ' + b.base.id}`)
if (a.base.id !== b.base.id) failures++

// 4. Every rule in the pool must yield a grammatical line — `craving`
//    is the phrasing used, `label` is only a fallback.
const { BASE_RULES } = await import('../src/lib/rules.js')
const missing = BASE_RULES.filter((r) => !r.craving)
console.log(`rules without a \`craving\` phrasing: ${missing.length === 0 ? '✓ none' : '✗ ' + missing.map(r => r.id).join(', ')}`)
if (missing.length) failures++

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exitCode = failures === 0 ? 0 : 1
