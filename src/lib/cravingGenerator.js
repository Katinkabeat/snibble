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
import { BASE_RULES, combineRules, weightedPick, rulesAreRedundant } from './rules.js'
import { getDictionary, getCommonWordSet, isCommonWord } from './dictionary.js'

const MIN_SOLUTIONS = 12
const MAX_SOLUTIONS = 30
const MAX_REGENERATIONS = 50
const TARGET_TRAY_SIZE = 7

// Match mode tunables — combined rules + 4-letter floor keep the
// puzzle meatier than daily, so the cap is tighter (30, not 50) and
// 2/3-letter words don't pad the count.
const MATCH_MIN_SOLUTIONS = 12
const MATCH_MAX_SOLUTIONS = 30
const MATCH_MAX_REGENERATIONS = 200
const MATCH_MIN_WORD_LENGTH = 4
// Minimum common-word intersection size for a pair to count as
// "viable" — below this, AND-ing the rules would produce too few
// matches even before tray constraints.
const MIN_PAIR_INTERSECTION = 30
// Maximum overlap ratio: if one rule's matches are mostly a subset of
// the other's (intersect / smaller-set > this), the pair feels
// duplicative even when families differ. Catches cases like
// starts:S + contains:ST where most ST words start with S.
const MAX_PAIR_OVERLAP_RATIO = 0.7

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
    if (anchors.length < MIN_SOLUTIONS) continue

    const tryWords = rng.sample(anchors, Math.min(5, anchors.length))
    const letters = buildTray(rng, tryWords, TARGET_TRAY_SIZE)
    const rackSet = new Set(letters)

    // Find every common-word solution that satisfies the rule AND is
    // spellable. Rare TWL-only words are intentionally excluded from
    // the puzzle — they're rejected on submit as "isn't a word" so
    // the puzzle stays fair regardless of the player's vocabulary depth.
    const solutions = []
    for (const w of dictionary) {
      if (!commonSet.has(w)) continue
      if (!base.matches(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      solutions.push(w)
      if (solutions.length > MAX_SOLUTIONS + 1) break // early exit
    }

    if (solutions.length < MIN_SOLUTIONS) continue
    if (solutions.length > MAX_SOLUTIONS) continue

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
      base: { id: base.id, label: base.label, family: base.family },
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

// ───────── Match-mode (combined-rule) generator ─────────
//
// Caches viable rule pairs at first call so the runtime cost is one
// O(rules²) pass over the common-word list. After that, every match
// puzzle is generated by sampling from the cached pair list and
// validating tray solvability the same way the daily generator does.

let cachedViablePairs = null

async function getViableRulePairs() {
  if (cachedViablePairs) return cachedViablePairs

  const dictionary = await getDictionary()
  const commonSet = await getCommonWordSet()

  // Gather common-word matches per rule, once.
  const matchesByRule = new Map()
  for (const rule of BASE_RULES) {
    const matches = []
    for (const w of dictionary) {
      if (!commonSet.has(w)) continue
      if (rule.matches(w)) matches.push(w)
    }
    matchesByRule.set(rule.id, new Set(matches))
  }

  // For every unordered pair, count intersection. Keep only pairs
  // above the threshold AND not from the same family (a "ends-in-OW
  // and ends-in-AT" combo is impossible; same-family pairs are
  // either redundant or contradictory).
  const pairs = []
  for (let i = 0; i < BASE_RULES.length; i++) {
    for (let j = i + 1; j < BASE_RULES.length; j++) {
      const a = BASE_RULES[i]
      const b = BASE_RULES[j]
      if (a.family === b.family) continue
      if (rulesAreRedundant(a, b)) continue
      const aMatches = matchesByRule.get(a.id)
      const bMatches = matchesByRule.get(b.id)
      let intersect = 0
      for (const w of aMatches) if (bMatches.has(w)) intersect++
      if (intersect < MIN_PAIR_INTERSECTION) continue
      const smaller = Math.min(aMatches.size, bMatches.size)
      if (smaller > 0 && intersect / smaller > MAX_PAIR_OVERLAP_RATIO) continue
      pairs.push({
        ruleA: a,
        ruleB: b,
        intersection: intersect,
        // Weight by sqrt of intersection so very-large pools don't
        // dominate; keeps variety high.
        weight: Math.max(1, Math.round(Math.sqrt(intersect))),
      })
    }
  }

  cachedViablePairs = pairs
  return pairs
}

/**
 * Normalize a rule-pair into a stable key so [A,B] and [B,A] hash the
 * same. Single-rule pairs (length 1) get just that id.
 */
export function rulePairKey(ruleIds) {
  return [...ruleIds].sort().join('|')
}

export async function generateMatchPuzzle(seedString, options = {}) {
  const { excludePairKeys = null } = options
  const dictionary = await getDictionary()
  const commonSet = await getCommonWordSet()
  const allViablePairs = await getViableRulePairs()
  const rng = rngFromSeed(seedString)

  // Apply the exclusion list if one was provided. Fall back to the
  // full pool if every pair is excluded (extreme edge case — would
  // mean a player has played hundreds of distinct combos).
  const filteredPairs = (excludePairKeys && excludePairKeys.size > 0)
    ? allViablePairs.filter(p => !excludePairKeys.has(rulePairKey([p.ruleA.id, p.ruleB.id])))
    : allViablePairs
  const viablePairs = filteredPairs.length > 0 ? filteredPairs : allViablePairs

  let attempt = 0
  while (attempt < MATCH_MAX_REGENERATIONS) {
    attempt++

    // Always combined-rule when a viable pair exists. Single-rule
    // match rounds blew past the solution cap too often (they look
    // identical to daily). Falling back to single only if the pair
    // pool is empty (shouldn't happen in practice).
    const useCombined = viablePairs.length > 0

    let baseIds, matcher, label, family
    if (useCombined) {
      const pair = weightedPick(rng, viablePairs)
      const combined = combineRules([pair.ruleA, pair.ruleB])
      baseIds = [pair.ruleA.id, pair.ruleB.id]
      matcher = combined.matches
      label = `${pair.ruleA.label} · ${pair.ruleB.label}`
      family = 'combined'
    } else {
      const single = weightedPick(rng, BASE_RULES)
      baseIds = [single.id]
      matcher = single.matches
      label = single.label
      family = single.family
    }

    // Anchor candidates from common words satisfying the (possibly
    // combined) rule.
    const anchors = []
    for (const w of dictionary) {
      if (!commonSet.has(w)) continue
      if (matcher(w)) {
        anchors.push(w)
        if (anchors.length >= 40) break
      }
    }
    if (anchors.length < MATCH_MIN_SOLUTIONS) continue

    const tryWords = rng.sample(anchors, Math.min(5, anchors.length))
    const letters = buildTray(rng, tryWords, TARGET_TRAY_SIZE)
    const rackSet = new Set(letters)

    const solutions = []
    for (const w of dictionary) {
      if (w.length < MATCH_MIN_WORD_LENGTH) continue
      if (!commonSet.has(w)) continue
      if (!matcher(w)) continue
      if (!spellableFrom(w, rackSet)) continue
      solutions.push(w)
      if (solutions.length > MATCH_MAX_SOLUTIONS + 1) break
    }
    if (solutions.length < MATCH_MIN_SOLUTIONS) continue
    if (solutions.length > MATCH_MAX_SOLUTIONS) continue

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
  if (!(await isCommonWord(w))) return { ok: false, reason: 'not-a-word' }
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
