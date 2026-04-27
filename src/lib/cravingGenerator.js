// ────────────────────────────────────────────────────────────
//  Daily Craving Generator
//
//  Given a seed (typically derived from today's date), produces a
//  fully-specified daily puzzle:
//
//    {
//      seed,         // the source seed string
//      base,         // base rule (the day's craving)
//      phases,       // [phase1, phase2, phase3]
//      letters,      // 12-14 letter tray
//      sampleSolutions: { phase1, phase2, phase3 },
//    }
//
//  Each phase is { rules: [...], label: "...", solutionCount: N }.
//
//  Solvability is enforced — the generator regenerates until each
//  phase has at least MIN_SOLUTIONS valid words findable from the
//  tray. If after MAX_REGENERATIONS attempts no good puzzle is
//  found, we relax constraints and try once more.
//
//  Letter reuse: the rack is treated as a "set" of available
//  letters — every letter in a candidate word must appear in the
//  rack at least once (no multiset matching, since players can
//  reuse letters in Snibble).
// ────────────────────────────────────────────────────────────

import { rngFromSeed, dailySeedString } from './rng.js'
import {
  BASE_RULES,
  PHASE3_BONUSES,
  lengthMinModifier,
  combineRules,
  weightedPick,
} from './rules.js'
import { getDictionary, isValidWord } from './dictionary.js'

const MIN_PHASE1_SOLUTIONS = 8
const MIN_PHASE2_SOLUTIONS = 4
const MIN_PHASE3_SOLUTIONS = 2
const MAX_REGENERATIONS = 50

// ───────── Letter pool & tray construction ─────────

// Distribution of letters in the english language, used as a baseline
// for filler letters when building a tray. Vowel-heavy enough to keep
// trays usable.
const FILLER_BAG = (
  'EEEEEEEAAAAAIIIIIIOOOOONNNNRRRRTTTTLLLSSSUUDDGGBCMPFHVWYK'
).split('')

/**
 * Build a tray of `targetSize` letters. Strategy:
 *   1. Take all unique letters from up to N example solution words for
 *      the hardest phase (phase 3) — guarantees those words are
 *      spellable.
 *   2. Fill remaining slots with weighted-random letters from FILLER_BAG.
 *   3. Sometimes inject a duplicate of common letters (looks more like
 *      a hand-curated tray than alphabet soup).
 *
 * Returns array of uppercase letters.
 */
function buildTray(rng, anchorWords, targetSize) {
  const letters = []
  const unique = new Set()

  // Anchor letters from solutions (covers them)
  const anchors = anchorWords.slice(0, 5).join('').split('')
  for (const c of rng.shuffle(anchors)) {
    if (!unique.has(c)) {
      unique.add(c)
      letters.push(c)
      if (letters.length >= targetSize) break
    }
  }

  // Fill the rest from the filler bag
  while (letters.length < targetSize) {
    letters.push(rng.pick(FILLER_BAG))
  }

  return rng.shuffle(letters)
}

/** Returns true if `word`'s letters are all available in the `rack` set. */
function spellableFrom(word, rackSet) {
  for (let i = 0; i < word.length; i++) {
    if (!rackSet.has(word[i])) return false
  }
  return true
}

// ───────── Solution finding ─────────

/**
 * Find all dictionary words that satisfy `rule` AND are spellable
 * from `rack`. Returns sorted array (longest first, then alpha).
 */
function findSolutions(dictionary, rule, rack) {
  const rackSet = new Set(rack)
  const out = []
  for (const w of dictionary) {
    if (rule.matches(w) && spellableFrom(w, rackSet)) {
      out.push(w)
      if (out.length > 200) break // cap for perf — we don't need all
    }
  }
  return out.sort((a, b) => (b.length - a.length) || a.localeCompare(b))
}

// ───────── Phase construction ─────────

/**
 * Given a base rule, build the three phases:
 *   - phase1 = base rule alone
 *   - phase2 = base rule + length floor
 *   - phase3 = base rule + length floor + bonus
 *
 * Length floors are picked based on what the base rule allows. If a
 * suffix is short (e.g. "-OW"), 4+ letters is appropriate. For longer
 * fixed endings (e.g. "-IGHT"), we may not add a length floor at all
 * since the suffix already implies a min length.
 */
function buildPhases(rng, base) {
  const phase1 = { rules: [base], label: base.label }

  // Phase 2: add length floor of 4+ or 5+ depending on rule.
  const len2 = rng.next() < 0.7 ? 4 : 5
  const lenMod2 = lengthMinModifier(len2)
  const phase2 = {
    rules: [base, lenMod2],
    label: `${base.label} · ${lenMod2.label}`,
  }

  // Phase 3: phase 2 rules + a bonus (different from base).
  const eligibleBonuses = PHASE3_BONUSES.filter((b) => b.id !== base.id)
  const bonus = weightedPick(rng, eligibleBonuses)
  const phase3 = {
    rules: [base, lenMod2, bonus],
    label: `${base.label} · ${lenMod2.label} · ${bonus.label}`,
  }

  return [phase1, phase2, phase3]
}

// ───────── Public API ─────────

/**
 * Generate the puzzle for a seed. Async because it loads the dictionary.
 * Resolves to the full puzzle object, or throws if generation fails
 * after max attempts (very rare — would mean every base rule is broken).
 */
export async function generatePuzzle(seedString) {
  const dictionary = await getDictionary()
  const rng = rngFromSeed(seedString)

  let attempt = 0
  while (attempt < MAX_REGENERATIONS) {
    attempt++

    // 1. Pick a base rule (weighted).
    const base = weightedPick(rng, BASE_RULES)

    // 2. Build the 3 phases.
    const phases = buildPhases(rng, base)

    // 3. Find candidate phase-3 solutions, drawing from the FULL
    //    dictionary (not yet constrained by a tray) — these become
    //    anchors for the tray construction. If phase 3 is too rare
    //    to find a few examples even unconstrained, abandon the rule.
    const combinedPhase3Rule = combineRules(phases[2].rules)
    const phase3Anchors = []
    for (const w of dictionary) {
      if (combinedPhase3Rule.matches(w)) {
        phase3Anchors.push(w)
        if (phase3Anchors.length >= 12) break
      }
    }
    if (phase3Anchors.length < MIN_PHASE3_SOLUTIONS) continue

    // 4. Build a tray that covers a few of those anchors plus filler.
    const trayPicks = rng.sample(phase3Anchors, Math.min(4, phase3Anchors.length))
    const letters = buildTray(rng, trayPicks, 13)

    // 5. Solvability check: count actual solutions per phase against
    //    the tray. A word counts only if all its letters are in the
    //    rack (with reuse allowed).
    const phase1Sols = findSolutions(dictionary, combineRules(phases[0].rules), letters)
    const phase2Sols = findSolutions(dictionary, combineRules(phases[1].rules), letters)
    const phase3Sols = findSolutions(dictionary, combinedPhase3Rule, letters)

    if (
      phase1Sols.length >= MIN_PHASE1_SOLUTIONS &&
      phase2Sols.length >= MIN_PHASE2_SOLUTIONS &&
      phase3Sols.length >= MIN_PHASE3_SOLUTIONS
    ) {
      // Annotate phases with their solution counts (handy for QA / UI).
      phases[0].solutionCount = phase1Sols.length
      phases[1].solutionCount = phase2Sols.length
      phases[2].solutionCount = phase3Sols.length

      return {
        seed: seedString,
        base: { id: base.id, label: base.label, family: base.family },
        phases: phases.map((p) => ({ label: p.label, solutionCount: p.solutionCount })),
        letters,
        sampleSolutions: {
          // First 8 solutions from each (cap so QA logs don't explode)
          phase1: phase1Sols.slice(0, 8),
          phase2: phase2Sols.slice(0, 8),
          phase3: phase3Sols.slice(0, 8),
        },
        attempt,
      }
    }
  }

  throw new Error(
    `Snibble craving generator failed after ${MAX_REGENERATIONS} attempts for seed "${seedString}". ` +
    `This shouldn't happen — investigate dictionary or rule families.`
  )
}

/** Convenience: today's puzzle (Atlantic time). */
export async function generateTodaysPuzzle(date = new Date()) {
  return generatePuzzle(dailySeedString(date))
}

/**
 * Validate a single feed: word must be in dictionary AND must satisfy
 * the active phase's combined rule. Returns
 *   { ok: true }                            — accept
 *   { ok: false, reason: 'not-a-word' }     — invalid word
 *   { ok: false, reason: 'wrong-rule' }     — valid word, doesn't match
 *
 * The unique-per-session rule (no duplicates) is enforced at the
 * UI/state level, not here.
 */
export async function validateFeed(word, phaseRules) {
  const w = (word || '').toUpperCase().trim()
  if (!(await isValidWord(w))) return { ok: false, reason: 'not-a-word' }
  const rule = combineRules(phaseRules)
  if (!rule.matches(w)) return { ok: false, reason: 'wrong-rule' }
  return { ok: true }
}

/** Scrabble-style letter values, shared with Wordy's scoring. */
const LETTER_VALUES = {
  A:1, B:3, C:3, D:2, E:1, F:4, G:2, H:4, I:1, J:8,
  K:5, L:1, M:3, N:1, O:1, P:3, Q:10, R:1, S:1, T:1,
  U:1, V:4, W:4, X:8, Y:4, Z:10,
}

/** Score a word the same way Wordy scores tiles — sum of letter values. */
export function scoreWord(word) {
  let total = 0
  for (const c of (word || '').toUpperCase()) total += LETTER_VALUES[c] || 0
  return total
}
