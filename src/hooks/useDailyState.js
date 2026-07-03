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
    expired: false,        // day rolled over mid-session; session auto-closed
    loaded: false,
  })
  const onGrowthRef = useRef(null)
  // The Atlantic date this session was loaded for. Pinned once at load
  // and reused for every write below, so a session that crosses midnight
  // keeps writing to the day it started (the puzzle that's actually loaded)
  // instead of spilling yesterday's solve onto today's feed_date.
  const sessionDateRef = useRef(null)
  // Guards so the midnight rollover only closes the session once, and so
  // the rollover watcher can read "already complete" without a stale
  // closure over state.
  const expiredRef = useRef(false)
  const completeRef = useRef(false)

  useEffect(() => { completeRef.current = state.isComplete }, [state.isComplete])

  useEffect(() => {
    if (!userId || !petId) return
    let active = true
    const date = atlanticToday()
    sessionDateRef.current = date

    expiredRef.current = false

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
          expired: false,
          loaded: true,
        })
      } else {
        setState({ wordsFed: [], score: 0, isComplete: false, expired: false, loaded: true })
      }
    }
    load()
    return () => { active = false }
  }, [userId, petId])

  // Midnight rollover watcher. If the day ticks over while a session is
  // open and unfinished, close it: lock in whatever was already fed onto
  // the day it was started (via the finalize RPC's one-day grace) and
  // flag `expired` so the UI can say "time's up for that daily". Any new
  // feed after this point would be rejected by the server guard anyway.
  useEffect(() => {
    if (!userId || !petId) return
    const id = setInterval(() => {
      if (
        !completeRef.current &&
        sessionDateRef.current &&
        atlanticToday() !== sessionDateRef.current
      ) {
        expireSession()
      }
    }, 30000)
    return () => clearInterval(id)
    // expireSession is stable enough for this purpose (reads refs, not state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const date = sessionDateRef.current || atlanticToday()

    // If the day rolled over since this session loaded, don't try to write
    // to a now-past date (the server guard would reject it). Close the
    // session instead — this is the honest late-night finisher's exit.
    if (atlanticToday() !== date) {
      await expireSession()
      return
    }

    const wasFirstFeed = state.wordsFed.length === 0
    const newWordsFed = [...state.wordsFed, { word, score: wordScore }]
    const newScore = state.score + wordScore
    const isComplete = !!willComplete

    setState((prev) => ({
      ...prev,
      wordsFed: newWordsFed,
      score: newScore,
      isComplete,
      loaded: true,
    }))

    // Writes go through the SECURITY DEFINER guard (sn_daily_feeds_write_guard):
    // it stamps user_id from auth.uid(), rejects any non-today feed_date, and
    // sets completed_at once on the finishing feed. Rook's #highlights
    // "mouthful" trigger keys off completed_at.
    const { error } = await supabase.rpc('sn_record_daily_feed', {
      p_feed_date: date,
      p_pet_id: petId,
      p_words_fed: newWordsFed.map((w) => w.word),
      p_score: newScore,
      p_is_complete: isComplete,
    })
    if (error) console.error('[useDailyState] record feed error', error)

    if (wasFirstFeed && onGrowthRef.current) {
      try { await onGrowthRef.current() } catch (e) { console.warn('[useDailyState] growth callback failed', e) }
    }
  }

  /**
   * Close a session whose day has rolled over. Locks in whatever was
   * already fed onto the day it started (the finalize RPC's one-day
   * grace) and flags `expired` so the UI can tell the player time's up.
   * Idempotent via expiredRef so the interval + a racing feed can't
   * double-fire it.
   */
  async function expireSession() {
    if (expiredRef.current) return
    expiredRef.current = true
    const date = sessionDateRef.current
    if (date) {
      const { error } = await supabase.rpc('sn_finalize_daily_feed', { p_feed_date: date })
      if (error) console.warn('[useDailyState] expire finalize error', error)
    }
    setState((prev) => ({ ...prev, isComplete: true, expired: true }))
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
    const date = sessionDateRef.current || atlanticToday()
    const { error } = await supabase
      .from('sn_daily_feeds')
      .delete()
      .eq('user_id', userId)
      .eq('feed_date', date)
    if (error) {
      console.error('[useDailyState] resetToday error', error)
      return
    }
    expiredRef.current = false
    setState({ wordsFed: [], score: 0, isComplete: false, expired: false, loaded: true })
  }

  /** Manually wrap up the session (player taps "Done for today"). */
  async function markComplete() {
    if (!userId || !petId) return
    if (state.isComplete) return
    if (state.wordsFed.length === 0) return
    const date = sessionDateRef.current || atlanticToday()
    setState((prev) => ({ ...prev, isComplete: true }))
    // Finalize goes through the guard's today/yesterday grace and only flips
    // is_complete on the existing row — it can't alter words or score.
    const { error } = await supabase.rpc('sn_finalize_daily_feed', { p_feed_date: date })
    if (error) console.error('[useDailyState] markComplete error', error)
  }

  return { state, recordFeed, onFirstFeed, markComplete, resetToday }
}
