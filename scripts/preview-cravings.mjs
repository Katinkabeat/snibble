#!/usr/bin/env node
/**
 * Preview the next 30 days of generated cravings under the v2 model
 * (single rule per day, total + par counts, difficulty stars).
 *
 * Run from the snibble directory:
 *   node scripts/preview-cravings.mjs
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

// Pre-populate dictionaries so dictionary.js's Node-fallback kicks in.
const wordsText = await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText.split('\n').map((w) => w.trim()).filter(Boolean)

const commonText = await fs.readFile(path.join(repoRoot, 'public/common-words.txt'), 'utf-8')
globalThis.__SNIBBLE_COMMON_WORDS__ = commonText.split('\n').map((w) => w.trim()).filter(Boolean)

const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')
const { dailySeedString } = await import('../src/lib/rng.js')

function fmt(n, w = 4) {
  return String(n).padStart(w)
}
function stars(d) {
  return '★'.repeat(d) + '☆'.repeat(3 - d)
}

console.log('Snibble — generated cravings preview (v2: phaseless, par-based)\n')
console.log('day | date       | craving                     | tray              | total  par  ★ | sample common')
console.log('----+------------+------------------------------+-------------------+----------------+----------------')

const now = new Date()
const stats = { difficulties: [0, 0, 0], totals: [], pars: [] }

for (let i = 0; i < 30; i++) {
  const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
  const seed = dailySeedString(d)
  try {
    const p = await generatePuzzle(seed)
    const day = String(i + 1).padStart(2, ' ')
    const date = seed.slice(-10)
    const craving = p.base.label.padEnd(28)
    const tray = p.letters.join(' ').padEnd(17)
    const counts = `${fmt(p.totalSolutions)} ${fmt(p.parCount)}  ${stars(p.difficulty)}`
    const common = p.sampleCommon.slice(0, 6).join(', ')
    console.log(`${day}  | ${date} | ${craving} | ${tray} | ${counts} | ${common}`)
    stats.difficulties[p.difficulty - 1]++
    stats.totals.push(p.totalSolutions)
    stats.pars.push(p.parCount)
  } catch (err) {
    console.log(`${i + 1} | FAILED: ${err.message}`)
  }
}

console.log(`\nDistribution: ★ easy ×${stats.difficulties[0]}  ★★ medium ×${stats.difficulties[1]}  ★★★ hard ×${stats.difficulties[2]}`)
console.log(`Solutions range: total ${Math.min(...stats.totals)}–${Math.max(...stats.totals)}, par ${Math.min(...stats.pars)}–${Math.max(...stats.pars)}`)
