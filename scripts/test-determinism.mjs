#!/usr/bin/env node
/**
 * Verify the daily craving generator is fully deterministic.
 * Same seed must produce the same puzzle every time.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const wordsText = await fs.readFile(path.join(repoRoot, 'public/words.txt'), 'utf-8')
globalThis.__SNIBBLE_DICTIONARY__ = wordsText.split('\n').map((w) => w.trim()).filter(Boolean)

const { generatePuzzle } = await import('../src/lib/cravingGenerator.js')

const seeds = [
  'snibble:daily:2026-04-27',
  'snibble:daily:2026-05-15',
  'snibble:daily:2026-12-31',
  'snibble:match:abc123',
  'snibble:match:zzz999',
]

let allPass = true

for (const seed of seeds) {
  const a = await generatePuzzle(seed)
  const b = await generatePuzzle(seed)

  const matches =
    a.base.id === b.base.id &&
    a.letters.join('') === b.letters.join('') &&
    a.phases[2].label === b.phases[2].label &&
    a.sampleSolutions.phase1.join(',') === b.sampleSolutions.phase1.join(',')

  console.log(
    `${matches ? '✓' : '✗'} ${seed}  →  base=${a.base.id}  tray=${a.letters.join('')}`
  )
  if (!matches) {
    allPass = false
    console.log('  diff:', { a, b })
  }
}

console.log(allPass ? '\nAll seeds deterministic. ✓' : '\nFAILED: at least one seed produced different output across runs.')
process.exit(allPass ? 0 : 1)
