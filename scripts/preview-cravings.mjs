#!/usr/bin/env node
/**
 * Preview the next 30 days of generated cravings.
 *
 * Run from the snibble directory:
 *   node scripts/preview-cravings.mjs
 *
 * Loads `public/words.txt`, mocks the import.meta.env.BASE_URL via a
 * fetch shim, and runs the generator for each upcoming Atlantic-time
 * date. Prints a compact table.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const wordsPath = path.join(repoRoot, 'public/words.txt')

// dictionary.js looks for globalThis.__SNIBBLE_DICTIONARY__ as a Node
// override before falling back to fetch — set it before importing.
const wordsText = await fs.readFile(wordsPath, 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText
  .split('\n')
  .map((w) => w.trim())
  .filter(Boolean)

const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')
const { dailySeedString } = await import('../src/lib/rng.js')

function fmt(n, w = 3) {
  return String(n).padStart(w)
}

console.log('Snibble — generated cravings preview\n')
console.log(
  'day | seed                       | base                            | phase 3 label                                                | tray                            | s1  s2  s3'
)
console.log(
  '----+---------------------------+---------------------------------+--------------------------------------------------------------+---------------------------------+-----------'
)

const now = new Date()
for (let i = 0; i < 30; i++) {
  const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
  const seed = dailySeedString(d)
  try {
    const p = await generatePuzzle(seed)
    const day = String(i + 1).padStart(2, ' ')
    const base = p.base.label.padEnd(31)
    const phase3 = p.phases[2].label.slice(0, 60).padEnd(60)
    const tray = p.letters.join(' ').padEnd(31)
    const counts = `${fmt(p.phases[0].solutionCount)} ${fmt(p.phases[1].solutionCount)} ${fmt(p.phases[2].solutionCount)}`
    console.log(`${day}  | ${seed.slice(-19).padEnd(25)} | ${base} | ${phase3} | ${tray} | ${counts}`)
  } catch (err) {
    console.log(`${i + 1} | FAILED: ${err.message}`)
  }
}

console.log('\nDone. Look for any rows where s1<8, s2<4, or s3<2 (would indicate the regen logic missed).')
