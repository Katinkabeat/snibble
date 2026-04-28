// ────────────────────────────────────────────────────────────
//  useDailyState — manages the user's session for today.
//
//  v2 (phaseless): tracks words fed, score, and is_complete only.
//  No per-phase counters. The progress bar in the UI uses the
//  ratio of wordsFed.length to puzzle.totalSolutions.
//
//  First successful feed of the day triggers a +1 growth tick on
//  the pet (any day with ≥1 valid word counts as a session).
// ────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

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
    wordsFed: [],          // [{ word, score }]
    score: 0,
    isComplete: false,
    loaded: false,
  })
  const onGrowthRef = useRef(null)

  useEffect(() => {
    if (!userId || !petId) return
    let active = true
    const date = atlanticToday()

    async function load() {
      const { data, error } = await supabase
        .from('sn_daily_feeds')
        .select('words_fed, score, is_complete')
        .eq('user_id', userId)
        .eq('feed_date', date)
        .maybeSingle()
      if (error) console.warn('[useDailyState] load error', error)
      if (!active) return

      if (data) {
        setState({
          wordsFed: (data.words_fed || []).map((w) => ({ word: w, score: 0 })),
          score: data.score || 0,
          isComplete: !!data.is_complete,
          loaded: true,
        })
      } else {
        setState({ wordsFed: [], score: 0, isComplete: false, loaded: true })
      }
    }
    load()
    return () => { active = false }
  }, [userId, petId])

  function onFirstFeed(cb) {
    onGrowthRef.current = cb
  }

  /**
   * Persist a successful feed.
   *   word          — uppercase word, already validated
   *   wordScore     — Scrabble values + length bonus
   *   willComplete  — true if this feed reaches 100% of total solutions
   */
  async function recordFeed({ word, wordScore, willComplete }) {
    if (!userId || !petId) return
    const date = atlanticToday()
    const wasFirstFeed = state.wordsFed.length === 0

    const newWordsFed = [...state.wordsFed, { word, score: wordScore }]
    const newScore = state.score + wordScore
    const isComplete = !!willComplete

    setState({
      wordsFed: newWordsFed,
      score: newScore,
      isComplete,
      loaded: true,
    })

    const { error } = await supabase
      .from('sn_daily_feeds')
      .upsert(
        {
          user_id: userId,
          feed_date: date,
          pet_id: petId,
          words_fed: newWordsFed.map((w) => w.word),
          score: newScore,
          is_complete: isComplete,
          // phases_done is vestigial post-v2; persist 0 so older
          // rows reading the column still get a valid integer.
          phases_done: 0,
        },
        { onConflict: 'user_id,feed_date' }
      )
    if (error) console.error('[useDailyState] upsert error', error)

    if (wasFirstFeed && onGrowthRef.current) {
      try { await onGrowthRef.current() } catch (e) { console.warn('[useDailyState] growth callback failed', e) }
    }
  }

  /**
   * Wipe today's session — used by the "Redo today" admin-gated
   * testing feature. Deletes the user's sn_daily_feeds row for
   * today and resets local state to a fresh day.
   *
   * Note: this does NOT roll back the +1 growth tick that fired on
   * first feed. Next first-feed will tick growth AGAIN. Acceptable
   * for the testing phase — the feature is gated behind an admin
   * toggle and meant for short-lived dev cycles, not production play.
   */
  async function resetToday() {
    if (!userId) return
    const date = atlanticToday()
    const { error } = await supabase
      .from('sn_daily_feeds')
      .delete()
      .eq('user_id', userId)
      .eq('feed_date', date)
    if (error) {
      console.error('[useDailyState] resetToday error', error)
      return
    }
    setState({ wordsFed: [], score: 0, isComplete: false, loaded: true })
  }

  /** Manually wrap up the session (player taps "Done for today"). */
  async function markComplete() {
    if (!userId || !petId) return
    if (state.isComplete) return
    if (state.wordsFed.length === 0) return
    const date = atlanticToday()
    setState((prev) => ({ ...prev, isComplete: true }))
    const { error } = await supabase
      .from('sn_daily_feeds')
      .update({ is_complete: true })
      .eq('user_id', userId)
      .eq('feed_date', date)
    if (error) console.error('[useDailyState] markComplete error', error)
  }

  return { state, recordFeed, onFirstFeed, markComplete, resetToday }
}
