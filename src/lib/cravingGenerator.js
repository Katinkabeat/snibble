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

const MIN_SOLUTIONS = 12
const MAX_SOLUTIONS = 30
// Bumped 50 → 150 alongside FULL_DICT_CAP: the cap rejects more trays, so
// the generator needs a deeper budget to never hard-error (see card #127).
const MAX_REGENERATIONS = 150
const TARGET_TRAY_SIZE = 7

// Ceiling on the full-TWL acceptable pool for a tray. Acceptance now uses
// the whole Scrabble list (not just common words), so without this a broad
// rule could accept 100+ obscure words. The par/100% target stays on the
// common list; this only bounds the bonus pool. Modeled mean ~34/game.
const FULL_DICT_CAP = 50

// Shortest word a player can feed, in both daily and match play. The
// solution count is filtered to this floor too, so par/100% reflect
// only words that are actually feedable.
const MIN_WORD_LENGTH = 4

// Match mode tunables — single rule, so a match feels as approachable
// as the daily craving (the head-to-head is the challenge, not the
// puzzle). Same 12–30 solution band as daily.
const MATCH_MIN_SOLUTIONS = 12
const MATCH_MAX_SOLUTIONS = 30
const MATCH_MAX_REGENERATIONS = 200

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
    // Narrow rules (e.g. -ABLE, -OOK) can't seed 12 common words from one
    // 7-letter tray, so they carry a lower per-rule floor.
    const minSol = base.minSolutions ?? MIN_SOLUTIONS

    // Anchor words for tray construction — pull from common words so
    // the tray is biased toward producing common-word solutions.
    const anchors = []
    for (const w of dictionary) {
      if (!commonSet.has(w)) continue
      if (base.matches(w)) {
        anchors.push(w)
        if (anchors.length >= 30) break
      }
    }
    if (anchors.length < minSol) continue

    const tryWords = rng.sample(anchors, Math.min(5, anchors.length))
    const letters = buildTray(rng, tryWords, TARGET_TRAY_SIZE)
    const rackSet = new Set(letters)

    // Count common-word solutions (spellable + matching). This drives the
    // par/100% target. Acceptance at submit time uses the full TWL list —
    // these common solutions are just the bar the player fills to.
    const solutions = []
    for (const w of dictionary) {
      if (w.length < MIN_WORD_LENGTH) continue
      if (!commonSet.has(w)) continue
      if (!base.matches(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      solutions.push(w)
      if (solutions.length > MAX_SOLUTIONS + 1) break // early exit
    }

    if (solutions.length < minSol) continue
    if (solutions.length > MAX_SOLUTIONS) continue

    // Full-dict guard: count every TWL word this tray would accept (not
    // just common ones) and reject the tray if it exceeds the cap. Run
    // only after the common gate passes, so the full scan stays rare.
    let fullCount = 0
    for (const w of dictionary) {
      if (w.length < MIN_WORD_LENGTH) continue
      if (!base.matches(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      if (++fullCount > FULL_DICT_CAP) break
    }
    if (fullCount > FULL_DICT_CAP) continue

    // Sort longest-first for nicer sample-solutions display in QA.
    solutions.sort((a, b) => (b.length - a.length) || a.localeCompare(b))

    const totalSolutions = solutions.length
    // Par tick on the fullness bar — set at ~60% of total. Crossing
    // it triggers the "fed her well today" toast as a mid-session
    // celebration before reaching the 100% "FULL" moment.
    const parCount = Math.ceil(totalSolutions * 0.6)
    // Difficulty thresholds for the 12–30 solution range.
    const difficulty = totalSolutions >= 22 ? 1 : totalSolutions >= 17 ? 2 : 3

    return {
      seed: seedString,
      base: { id: base.id, label: base.label, craving: base.craving, family: base.family },
      letters,
      totalSolutions,
      parCount,
      difficulty,
      // QA-only — not surfaced to the player at runtime, but useful
      // for the preview script and tests.
      sampleSolutions: solutions.slice(0, 12),
      sampleCommon: solutions.slice(0, 12),
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

// ───────── Match-mode generator ─────────
//
// A match round is a single-rule puzzle, same shape as the daily
// craving — the competition is the challenge, so the puzzle itself
// stays approachable. base_rule_ids is stored as a one-element array
// (matcherFromBaseIds handles both 1- and 2-element arrays, so older
// 2-rule rounds still validate).

/**
 * Normalize a rule selection into a stable key so dedup history hashes
 * consistently. Single-rule rounds get just that id; legacy two-rule
 * rounds get a sorted "a|b" key.
 */
export function rulePairKey(ruleIds) {
  return [...ruleIds].sort().join('|')
}

export async function generateMatchPuzzle(seedString, options = {}) {
  const { excludePairKeys = null } = options
  const dictionary = await getDictionary()
  const commonSet = await getCommonWordSet()
  const rng = rngFromSeed(seedString)

  // Dedup against the players' recent rule history so back-to-back
  // matches don't repeat a rule. Fall back to the full set if every
  // rule is excluded (would take a long streak of distinct rules).
  const filteredRules = (excludePairKeys && excludePairKeys.size > 0)
    ? BASE_RULES.filter(r => !excludePairKeys.has(rulePairKey([r.id])))
    : BASE_RULES
  const rulePool = filteredRules.length > 0 ? filteredRules : BASE_RULES

  let attempt = 0
  while (attempt < MATCH_MAX_REGENERATIONS) {
    attempt++

    const rule = weightedPick(rng, rulePool)
    const baseIds = [rule.id]
    const matcher = rule.matches
    const label = rule.label
    const family = rule.family
    const minSol = rule.minSolutions ?? MATCH_MIN_SOLUTIONS

    // Anchor candidates from common words satisfying the rule.
    const anchors = []
    for (const w of dictionary) {
      if (!commonSet.has(w)) continue
      if (matcher(w)) {
        anchors.push(w)
        if (anchors.length >= 40) break
      }
    }
    if (anchors.length < minSol) continue

    const tryWords = rng.sample(anchors, Math.min(5, anchors.length))
    const letters = buildTray(rng, tryWords, TARGET_TRAY_SIZE)
    const rackSet = new Set(letters)

    const solutions = []
    for (const w of dictionary) {
      if (w.length < MIN_WORD_LENGTH) continue
      if (!commonSet.has(w)) continue
      if (!matcher(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      solutions.push(w)
      if (solutions.length > MATCH_MAX_SOLUTIONS + 1) break
    }
    if (solutions.length < minSol) continue
    if (solutions.length > MATCH_MAX_SOLUTIONS) continue

    // Full-dict guard (same as daily) — keep acceptance uniform across modes.
    let fullCount = 0
    for (const w of dictionary) {
      if (w.length < MIN_WORD_LENGTH) continue
      if (!matcher(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      if (++fullCount > FULL_DICT_CAP) break
    }
    if (fullCount > FULL_DICT_CAP) continue

    solutions.sort((a, b) => (b.length - a.length) || a.localeCompare(b))
    const totalSolutions = solutions.length
    const parCount = Math.ceil(totalSolutions * 0.6)
    const difficulty = totalSolutions >= 22 ? 1 : totalSolutions >= 17 ? 2 : 3

    return {
      seed: seedString,
      base: { ids: baseIds, label, family },
      letters,
      totalSolutions,
      parCount,
      difficulty,
      sampleSolutions: solutions.slice(0, 12),
      attempt,
    }
  }

  throw new Error(
    `Snibble match generator failed after ${MATCH_MAX_REGENERATIONS} attempts for seed "${seedString}".`
  )
}

export function matchSeedString(matchId, roundIndex) {
  return `snibble:match:${matchId}:${roundIndex}`
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

// ───────── Scoring ─────────
// 1 point per letter. No Scrabble values, no length bonuses — keeps
// scores comparable across days regardless of which rare letters the
// craving happens to land on.

export function scoreWord(word) {
  return (word || '').length
}
