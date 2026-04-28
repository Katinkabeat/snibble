// ────────────────────────────────────────────────────────────
//  Daily Craving Generator (v2 — phases removed)
//
//  Given a seed (typically derived from today's date), produces a
//  single-rule daily puzzle:
//
//    {
//      seed,
//      base:           { id, label, family },
//      letters:        ['A','B','C', ...]    // 12-14 letters
//      totalSolutions: number   // valid TWL words matching today's
//                               // rule that can be spelled from the
//                               // tray (with letter reuse)
//      parCount:       number   // subset of totalSolutions also in
//                               // the common-words list. The "par
//                               // line" — what an average player
//                               // can reach with some effort.
//      difficulty:     1 | 2 | 3   // ★ rating; based on parCount
//    }
//
//  Phases (the previous nested-rule structure) are gone. Each daily
//  puzzle is now a single open-ended challenge: "today's craving is
//  X, find as many qualifying words as you can." Players cap their
//  own session length with the "Done for today" button or by hitting
//  100% of solutions.
//
//  Solvability target: ≥8 total solutions. Lower bar than v1 since
//  there's no phase 3 to also satisfy.
//
//  Letter reuse: letters are treated as a SET — every letter in a
//  candidate word must appear at least once in the tray. No
//  multiset matching since players can reuse letters freely.
// ────────────────────────────────────────────────────────────

import { rngFromSeed, dailySeedString } from './rng.js'
import { BASE_RULES, weightedPick } from './rules.js'
import { getDictionary, getCommonWordSet, isValidWord } from './dictionary.js'

const MIN_SOLUTIONS = 8
const MAX_REGENERATIONS = 50
const TARGET_TRAY_SIZE = 13

// ───────── Letter pool & tray construction ─────────

const FILLER_BAG = (
  'EEEEEEEAAAAAIIIIIIOOOOONNNNRRRRTTTTLLLSSSUUDDGGBCMPFHVWYK'
).split('')

function buildTray(rng, anchorWords, targetSize) {
  const letters = []
  const unique = new Set()
  const anchors = anchorWords.slice(0, 5).join('').split('')

  for (const c of rng.shuffle(anchors)) {
    if (!unique.has(c)) {
      unique.add(c)
      letters.push(c)
      if (letters.length >= targetSize) break
    }
  }
  while (letters.length < targetSize) {
    letters.push(rng.pick(FILLER_BAG))
  }
  return rng.shuffle(letters)
}

function spellableFrom(word, rackSet) {
  for (let i = 0; i < word.length; i++) {
    if (!rackSet.has(word[i])) return false
  }
  return true
}

// ───────── Public API ─────────

export async function generatePuzzle(seedString) {
  const dictionary = await getDictionary()
  const commonSet = await getCommonWordSet()
  const rng = rngFromSeed(seedString)

  let attempt = 0
  while (attempt < MAX_REGENERATIONS) {
    attempt++

    const base = weightedPick(rng, BASE_RULES)

    // Anchor words for tray construction — pick from full dictionary
    // matches before constraining to a tray.
    const anchors = []
    for (const w of dictionary) {
      if (base.matches(w)) {
        anchors.push(w)
        if (anchors.length >= 30) break
      }
    }
    if (anchors.length < MIN_SOLUTIONS) continue

    const tryWords = rng.sample(anchors, Math.min(5, anchors.length))
    const letters = buildTray(rng, tryWords, TARGET_TRAY_SIZE)
    const rackSet = new Set(letters)

    // Find every solution that satisfies the rule AND is spellable.
    const allSolutions = []
    const commonSolutions = []
    for (const w of dictionary) {
      if (!base.matches(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      allSolutions.push(w)
      if (commonSet.has(w)) commonSolutions.push(w)
      if (allSolutions.length > 1000) break // safety cap
    }

    if (allSolutions.length < MIN_SOLUTIONS) continue

    // Sort longest-first for nicer sample-solutions display in QA.
    allSolutions.sort((a, b) => (b.length - a.length) || a.localeCompare(b))
    commonSolutions.sort((a, b) => (b.length - a.length) || a.localeCompare(b))

    const parCount = commonSolutions.length
    // Difficulty thresholds tuned against 30-day previews so the
    // distribution sits roughly 1/3 each. Tweak after play data.
    const difficulty = parCount >= 15 ? 1 : parCount >= 6 ? 2 : 3

    return {
      seed: seedString,
      base: { id: base.id, label: base.label, family: base.family },
      letters,
      totalSolutions: allSolutions.length,
      parCount,
      difficulty,
      // QA-only — not surfaced to the player at runtime, but useful
      // for the preview script and tests.
      sampleSolutions: allSolutions.slice(0, 12),
      sampleCommon: commonSolutions.slice(0, 12),
      attempt,
    }
  }

  throw new Error(
    `Snibble craving generator failed after ${MAX_REGENERATIONS} attempts for seed "${seedString}". ` +
    `Investigate dictionary or rule families.`
  )
}

export async function generateTodaysPuzzle(date = new Date()) {
  return generatePuzzle(dailySeedString(date))
}

/**
 * Validate a single feed against today's craving rule.
 *   { ok: true }                          — accept
 *   { ok: false, reason: 'not-a-word' }   — invalid TWL word
 *   { ok: false, reason: 'wrong-rule' }   — valid word, doesn't match
 */
export async function validateFeed(word, ruleMatcher) {
  const w = (word || '').toUpperCase().trim()
  if (!(await isValidWord(w))) return { ok: false, reason: 'not-a-word' }
  if (!ruleMatcher(w)) return { ok: false, reason: 'wrong-rule' }
  return { ok: true }
}

// ───────── Scoring (Scrabble values + length bonus) ─────────

const LETTER_VALUES = {
  A:1, B:3, C:3, D:2, E:1, F:4, G:2, H:4, I:1, J:8,
  K:5, L:1, M:3, N:1, O:1, P:3, Q:10, R:1, S:1, T:1,
  U:1, V:4, W:4, X:8, Y:4, Z:10,
}

/**
 * Score a fed word: sum of Scrabble letter values + length bonus.
 *   - Base: sum of letter values
 *   - +5 if word is 5–6 letters
 *   - +15 if word is 7+ letters
 *
 * (The bonus tiers stack for length only — a 7-letter word gets +15,
 *  not +5+15. Encourages reaching for longer words without making
 *  short words feel worthless.)
 */
export function scoreWord(word) {
  const w = (word || '').toUpperCase()
  let total = 0
  for (const c of w) total += LETTER_VALUES[c] || 0
  if (w.length >= 7) total += 15
  else if (w.length >= 5) total += 5
  return total
}
