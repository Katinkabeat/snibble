// ────────────────────────────────────────────────────────────
//  dailyPuzzle — DB-backed loader for the daily craving.
//
//  The puzzle for a given Atlantic date is generated once, stored in
//  sn_daily_puzzles, and read by everyone after that. This pins the
//  day's puzzle so a later change to cravingGenerator.js only affects
//  days that haven't started yet — deploying never re-rolls the day
//  that's already in progress.
//
//  Generation is client-side (the generator is JS + the word list) but
//  deterministic, so two clients on the same code compute the identical
//  puzzle; the RPC's "first writer wins" just decides who persists it.
//
//  Returns the same shape as generatePuzzle so callers are unchanged:
//    { seed, base: { id, label, craving, family }, letters,
//      totalSolutions, parCount, difficulty }
// ────────────────────────────────────────────────────────────

import { supabase } from './supabase.js'
import { generateTodaysPuzzle } from './cravingGenerator.js'
import { dailySeedString } from './rng.js'
import { RULES_BY_ID } from './rules.js'

/** Atlantic (America/Halifax) calendar date as 'YYYY-MM-DD'. */
function atlanticDateIso(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Build the generatePuzzle-shaped object from a stored row. */
function shapeFromRow(row, date) {
  const rule = RULES_BY_ID[row.base_rule_ids?.[0]]
  return {
    seed: dailySeedString(date),
    base: rule
      ? { id: rule.id, label: rule.label, craving: rule.craving, family: rule.family }
      : { id: row.base_rule_ids?.[0] },
    letters: row.letters,
    totalSolutions: row.total_solutions,
    parCount: row.par_count,
    difficulty: row.difficulty,
  }
}

/**
 * Load today's (or the given date's) daily puzzle, generating + storing
 * it if it doesn't exist yet. Read-first so the common path skips the
 * generator (and its dictionary load) entirely.
 */
export async function loadDailyPuzzle(date = new Date()) {
  const dateIso = atlanticDateIso(date)

  const { data: existing, error: readErr } = await supabase
    .from('sn_daily_puzzles')
    .select('*')
    .eq('puzzle_date', dateIso)
    .maybeSingle()
  if (readErr) console.warn('[dailyPuzzle] read failed:', readErr.message)
  if (existing) return shapeFromRow(existing, date)

  // No row yet — generate locally and persist via the RPC, which returns
  // the authoritative row (in case another client inserted first).
  const local = await generateTodaysPuzzle(date)
  const { data: row, error: rpcErr } = await supabase.rpc('sn_get_or_create_daily_puzzle', {
    p_date: dateIso,
    p_base_rule_ids: [local.base.id],
    p_letters: local.letters,
    p_total: local.totalSolutions,
    p_par: local.parCount,
    p_difficulty: local.difficulty,
  })
  if (rpcErr || !row) {
    // Persisting failed — fall back to the deterministic local puzzle so
    // play isn't blocked. It still matches other same-code clients; it's
    // just not pinned in the DB for this one.
    if (rpcErr) console.warn('[dailyPuzzle] store failed, using local puzzle:', rpcErr.message)
    return local
  }
  return shapeFromRow(Array.isArray(row) ? row[0] : row, date)
}
