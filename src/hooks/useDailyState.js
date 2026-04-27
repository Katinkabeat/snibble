// ────────────────────────────────────────────────────────────
//  useDailyState — manages the user's session for today.
//
//  Reads the existing sn_daily_feeds row for today (Atlantic time)
//  if any, or sets up an in-memory state object to start fresh.
//  Persists each successful feed back to the row.
//
//  Phase progression: phases are nested (phase 3 implies phase 2
//  implies phase 1), so a fed word counts toward the highest phase
//  it satisfies. We track per-phase fed counts; phase N is "done"
//  once 3 words have credited it.
//
//  First successful feed of the day triggers a +1 growth tick on
//  the pet (the rule is "any day with at least 1 valid word counts
//  as a successful session toward growth").
// ────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

/** YYYY-MM-DD in Atlantic time — same notion of "today" as the seed. */
function atlanticToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function useDailyState({ userId, petId }) {
  const [state, setState] = useState({
    wordsFed: [],          // [{ word, score, phase }]
    score: 0,
    isComplete: false,     // true once all 3 phases have 3+ feeds each
    loaded: false,
  })
  const onGrowthRef = useRef(null) // optional callback when first feed triggers growth tick

  useEffect(() => {
    if (!userId || !petId) return
    let active = true
    const date = atlanticToday()

    async function load() {
      const { data, error } = await supabase
        .from('sn_daily_feeds')
        .select('words_fed, score, phases_done, is_complete')
        .eq('user_id', userId)
        .eq('feed_date', date)
        .maybeSingle()
      if (error) console.warn('[useDailyState] load error', error)
      if (!active) return

      // The sn_daily_feeds.words_fed is a string[] — we need to recover
      // per-word phase info. For now we don't persist phase breakdown,
      // so on reload we recompute counts purely from the string list
      // by re-running the rule against each word. To avoid a circular
      // dep with the puzzle, we leave words[].phase undefined on load
      // and only use the totals — the GameView re-derives phase counts
      // when it has access to the puzzle.
      if (data) {
        setState({
          wordsFed: (data.words_fed || []).map((w) => ({ word: w, score: 0, phase: null })),
          score: data.score || 0,
          isComplete: !!data.is_complete,
          loaded: true,
        })
      } else {
        setState({ wordsFed: [], score: 0, isComplete: false, loaded: true })
      }
    }
    load()
    return () => {
      active = false
    }
  }, [userId, petId])

  /** Register a callback to fire on the FIRST feed of the day. */
  function onFirstFeed(cb) {
    onGrowthRef.current = cb
  }

  /**
   * Persist a successful feed. Called by GameView after the generator
   * has confirmed the word matches the active phase rule.
   *   word         — uppercase string, validated as a real word + matches rule
   *   wordScore    — Scrabble letter sum
   *   matchedPhase — 1, 2, or 3 — the highest phase this word satisfies
   *   willComplete — true if this feed completes all 3 phases
   */
  async function recordFeed({ word, wordScore, matchedPhase, willComplete }) {
    if (!userId || !petId) return
    const date = atlanticToday()
    const wasFirstFeed = state.wordsFed.length === 0

    const newWordsFed = [...state.wordsFed, { word, score: wordScore, phase: matchedPhase }]
    const newScore = state.score + wordScore
    const newPhasesDone = countCompletedPhases(newWordsFed)
    const isComplete = !!willComplete

    setState({
      wordsFed: newWordsFed,
      score: newScore,
      isComplete,
      loaded: true,
    })

    // Upsert (insert if missing, update otherwise).
    const { error } = await supabase
      .from('sn_daily_feeds')
      .upsert(
        {
          user_id: userId,
          feed_date: date,
          pet_id: petId,
          words_fed: newWordsFed.map((w) => w.word),
          score: newScore,
          phases_done: newPhasesDone,
          is_complete: isComplete,
        },
        { onConflict: 'user_id,feed_date' }
      )
    if (error) console.error('[useDailyState] upsert error', error)

    if (wasFirstFeed && onGrowthRef.current) {
      try { await onGrowthRef.current() } catch (e) { console.warn('[useDailyState] growth callback failed', e) }
    }
  }

  /** Manually wrap up the session (player taps "Done for today"). */
  async function markComplete() {
    if (!userId || !petId) return
    if (state.isComplete) return
    if (state.wordsFed.length === 0) {
      // Nothing to wrap up yet — don't persist an empty completed row.
      return
    }
    const date = atlanticToday()
    setState((prev) => ({ ...prev, isComplete: true }))
    const { error } = await supabase
      .from('sn_daily_feeds')
      .update({ is_complete: true })
      .eq('user_id', userId)
      .eq('feed_date', date)
    if (error) console.error('[useDailyState] markComplete error', error)
  }

  return { state, recordFeed, onFirstFeed, markComplete }
}

/** How many of the 3 phases have ≥3 feeds credited to them? */
function countCompletedPhases(wordsFed) {
  const perPhase = [0, 0, 0] // index 0 = phase 1, etc.
  for (const w of wordsFed) {
    if (w.phase >= 1 && w.phase <= 3) perPhase[w.phase - 1]++
  }
  return perPhase.filter((c) => c >= 3).length
}
