// ────────────────────────────────────────────────────────────
//  matchActions — write helpers for the match lifecycle.
//
//  All functions require an authenticated supabase client; they
//  rely on RLS to ensure the caller is a valid participant.
// ────────────────────────────────────────────────────────────

import { supabase } from './supabase.js'
import { generateMatchPuzzle, matchSeedString, scoreWord, rulePairKey } from './cravingGenerator.js'
import { RULES_BY_ID, combineRules } from './rules.js'

// How many recent matches per player to consider when deduping rule
// pairs at creation time. Friend matches dedup against both players'
// recent history; open matches against the creator's history only.
const RULE_PAIR_HISTORY_DEPTH = 15

/**
 * Fetch the rule-pair keys from each player's most recent matches.
 * Used to filter the viable-pair pool before picking a new match's
 * rule pair, so back-to-back matches don't repeat combos.
 */
async function fetchRecentRulePairKeys(userIds) {
  const validIds = (userIds || []).filter(Boolean)
  if (validIds.length === 0) return new Set()
  const { data, error } = await supabase.rpc('sn_recent_match_rule_ids', {
    p_user_ids: validIds,
    p_limit: RULE_PAIR_HISTORY_DEPTH,
  })
  if (error) {
    // Soft-fail: log and proceed without dedup. Better to occasionally
    // repeat a combo than to break match creation entirely.
    console.warn('[matchActions] rule-pair history fetch failed:', error.message)
    return new Set()
  }
  const keys = new Set()
  for (const row of data ?? []) {
    if (Array.isArray(row.rule_ids) && row.rule_ids.length > 0) {
      keys.add(rulePairKey(row.rule_ids))
    }
  }
  return keys
}

/**
 * Create a new match. Inserts the sn_matches row, then pre-generates
 * + inserts the single round puzzle.
 *
 * Pass `invitedUserId` to make it a private friend invite (only that
 * user can see/join, auto-cancels in 24 hours). Omit for an open match
 * (anyone joins, auto-cancels in 7 days). expires_at is filled by the
 * sn_set_match_expiry trigger — we don't pass it.
 *
 * Returns the new match row.
 */
export async function createMatch({ userId, invitedUserId = null }) {
  // Friend invite → dedup against both players' history. Open match →
  // creator only (opponent unknown at creation time).
  const historyUserIds = invitedUserId ? [userId, invitedUserId] : [userId]

  // History fetch and match insert are independent — only the puzzle
  // step downstream needs both. Running them in parallel saves one
  // round-trip (~100-200ms) on every invite.
  const [excludePairKeys, matchResult] = await Promise.all([
    fetchRecentRulePairKeys(historyUserIds),
    supabase
      .from('sn_matches')
      .insert({
        format: 'single',
        status: 'open',
        creator_id: userId,
        invited_user_id: invitedUserId,
        is_public: invitedUserId == null,
      })
      .select()
      .single(),
  ])
  const { data: match, error: matchErr } = matchResult
  if (matchErr) throw matchErr

  const seed = matchSeedString(match.id, 0)
  const puzzle = await generateMatchPuzzle(seed, { excludePairKeys })
  const { error: roundsErr } = await supabase
    .from('sn_match_rounds')
    .insert({
      match_id: match.id,
      round_index: 0,
      seed,
      base_rule_ids: puzzle.base.ids,
      letters: puzzle.letters,
      total_solutions: puzzle.totalSolutions,
      par_count: puzzle.parCount,
      difficulty: puzzle.difficulty,
    })
  if (roundsErr) throw roundsErr

  return match
}

/**
 * Cancel a match the current user created. Server enforces:
 *   - caller is the creator
 *   - status is 'open' or 'in_progress'
 *   - no plays have been submitted yet
 * On success, status → 'cancelled' and cancelled_at = now().
 */
export async function cancelMatch({ matchId }) {
  const { error } = await supabase.rpc('sn_cancel_match', { p_match_id: matchId })
  if (error) throw error
}

/**
 * Sweeps any past-expiry open matches to status='expired'. Safe to
 * call from anywhere — server-side function only updates rows that
 * are actually past their deadline.
 */
export async function expireStaleMatches() {
  const { error } = await supabase.rpc('sn_expire_stale_matches')
  if (error) throw error
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
    .select('creator_id, opponent_id, status')
    .eq('id', matchId)
    .single()
  if (!match || match.status === 'completed') return { complete: false, score }

  const total = 1

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

  // Decide winner: higher total wins. Equal scores = tie (winner_id stays null).
  let winnerId = null
  if (creatorPlays.total > opponentPlays.total) winnerId = match.creator_id
  else if (opponentPlays.total > creatorPlays.total) winnerId = match.opponent_id

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
 * Claim a stalled match. Allowed when last_activity_at is older than
 * 7 days (enforced client-side; server check is best-effort via the
 * status='in_progress' filter on the update). Sets winner = caller,
 * status = 'completed', completed_at = now.
 */
export async function claimMatchWin({ matchId, userId }) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('sn_matches')
    .update({
      status: 'completed',
      winner_id: userId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'in_progress')
    .lte('last_activity_at', sevenDaysAgo)
    .select()
    .single()
  if (error) throw error
  if (!data) throw new Error('Match not eligible to claim — opponent may have submitted recently.')
  return data
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
