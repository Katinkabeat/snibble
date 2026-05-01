// ────────────────────────────────────────────────────────────
//  matchActions — write helpers for the match lifecycle.
//
//  All functions require an authenticated supabase client; they
//  rely on RLS to ensure the caller is a valid participant.
// ────────────────────────────────────────────────────────────

import { supabase } from './supabase.js'
import { generateMatchPuzzle, matchSeedString, scoreWord } from './cravingGenerator.js'
import { RULES_BY_ID, combineRules } from './rules.js'

/**
 * Create a new match. Inserts the sn_matches row, then pre-generates
 * + inserts the round puzzles.
 *
 * Returns the new match row.
 */
export async function createMatch({ userId, format }) {
  if (format !== 'single' && format !== 'best_of_3') {
    throw new Error(`Unknown format: ${format}`)
  }

  const { data: match, error: matchErr } = await supabase
    .from('sn_matches')
    .insert({
      format,
      status: 'open',
      creator_id: userId,
      is_public: true,
    })
    .select()
    .single()
  if (matchErr) throw matchErr

  const roundCount = format === 'best_of_3' ? 3 : 1
  const rounds = []
  for (let i = 0; i < roundCount; i++) {
    const seed = matchSeedString(match.id, i)
    const puzzle = await generateMatchPuzzle(seed)
    rounds.push({
      match_id: match.id,
      round_index: i,
      seed,
      base_rule_ids: puzzle.base.ids,
      letters: puzzle.letters,
      total_solutions: puzzle.totalSolutions,
      par_count: puzzle.parCount,
      difficulty: puzzle.difficulty,
    })
  }

  const { error: roundsErr } = await supabase
    .from('sn_match_rounds')
    .insert(rounds)
  if (roundsErr) throw roundsErr

  return match
}

/** Join an open match as the opponent. Flips status → in_progress. */
export async function joinMatch({ matchId, userId }) {
  const { data, error } = await supabase
    .from('sn_matches')
    .update({
      opponent_id: userId,
      status: 'in_progress',
      joined_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'open')
    .is('opponent_id', null)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Submit a player's words for a single round of a match. Computes
 * the score from the word list (flat per-letter, same as daily).
 *
 * After insert, checks whether both players have now submitted ALL
 * rounds of the match — if so, declares the winner and flips the
 * match to 'completed'.
 */
export async function submitMatchRound({ matchId, roundIndex, userId, wordsFed }) {
  const score = wordsFed.reduce((s, w) => s + scoreWord(w), 0)

  const { error: insertErr } = await supabase
    .from('sn_match_round_plays')
    .insert({
      match_id: matchId,
      round_index: roundIndex,
      user_id: userId,
      words_fed: wordsFed,
      score,
    })
  if (insertErr) throw insertErr

  // Always touch last_activity_at so the auto-resolve clock resets.
  await supabase
    .from('sn_matches')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', matchId)

  // Check completion: do BOTH players have plays for every round?
  const { data: match } = await supabase
    .from('sn_matches')
    .select('format, creator_id, opponent_id, status')
    .eq('id', matchId)
    .single()
  if (!match || match.status === 'completed') return { complete: false, score }

  const total = match.format === 'best_of_3' ? 3 : 1

  // sn_match_round_plays RLS lets each player see their own + opponent's
  // (after both submit a given round). For the "are we done" check we
  // only need our own submission count and to verify opponent has the
  // same — but RLS may hide opponent rows on rounds where we haven't
  // submitted. Workaround: count distinct users with row counts.
  const { data: plays } = await supabase
    .from('sn_match_round_plays')
    .select('user_id, round_index, score')
    .eq('match_id', matchId)

  const byUser = new Map()
  for (const p of plays ?? []) {
    const sums = byUser.get(p.user_id) ?? { rounds: new Set(), total: 0 }
    sums.rounds.add(p.round_index)
    sums.total += p.score
    byUser.set(p.user_id, sums)
  }

  const creatorPlays = byUser.get(match.creator_id)
  const opponentPlays = match.opponent_id ? byUser.get(match.opponent_id) : null
  const bothDone =
    creatorPlays && opponentPlays &&
    creatorPlays.rounds.size === total &&
    opponentPlays.rounds.size === total

  if (!bothDone) return { complete: false, score }

  // Decide winner: higher total wins. Ties go to whoever submitted last
  // round earlier (matches the daily leaderboard tiebreak rule).
  let winnerId = null
  if (creatorPlays.total > opponentPlays.total) winnerId = match.creator_id
  else if (opponentPlays.total > creatorPlays.total) winnerId = match.opponent_id
  else {
    // Tie — pick the player whose last submission was earlier. Pull
    // submitted_at since the totals are equal.
    const { data: lastPlays } = await supabase
      .from('sn_match_round_plays')
      .select('user_id, submitted_at')
      .eq('match_id', matchId)
      .order('submitted_at', { ascending: false })
      .limit(2)
    // The earlier of the two latest is the tiebreak winner.
    if (lastPlays && lastPlays.length === 2) {
      winnerId = lastPlays[1].user_id
    }
  }

  await supabase
    .from('sn_matches')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      winner_id: winnerId,
    })
    .eq('id', matchId)

  return { complete: true, score, winnerId }
}

/**
 * Reconstruct a rule matcher from base_rule_ids stored on the round.
 * Single id → that rule. Two ids → AND-combined.
 */
export function matcherFromBaseIds(baseRuleIds) {
  const rules = baseRuleIds.map((id) => RULES_BY_ID[id]).filter(Boolean)
  if (rules.length === 0) {
    throw new Error(`No known rules for ids: ${baseRuleIds.join(', ')}`)
  }
  if (rules.length === 1) return rules[0]
  return combineRules(rules)
}
