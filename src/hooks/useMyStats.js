// ────────────────────────────────────────────────────────────
//  useMyStats — lifetime + streak stats for the current user,
//  for the My Stats tab of the Stats modal.
//
//  Returns:
//    streak           : current consecutive-day streak (incl. today
//                       if fed; otherwise counts back from yesterday)
//    totalWordsFed    : sum of words_fed lengths across all days
//    longestWord      : longest word ever fed
//    favoriteWord     : most-frequently fed word (ties → longer)
//    favoriteCount
//    petsRaised       : count of graduated sn_progress rows
//    sessionCount     : count of sn_daily_feeds rows
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useMyStats(userId) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      setLoading(true)
      try {
        const [
          { data: feedRows, error: feedErr },
          { data: progressRows, error: progErr },
          { data: matchRows, error: matchErr },
          { data: matchPlays, error: matchPlaysErr },
        ] = await Promise.all([
          supabase
            .from('sn_daily_feeds')
            .select('feed_date, words_fed')
            .eq('user_id', userId)
            .order('feed_date', { ascending: false }),
          supabase
            .from('sn_progress')
            .select('graduated_at')
            .eq('user_id', userId),
          supabase
            .from('sn_matches')
            .select('id, status, winner_id, creator_id, opponent_id')
            .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
            .eq('status', 'completed'),
          supabase
            .from('sn_match_round_plays')
            .select('match_id, round_index, user_id, words_fed, score'),
        ])
        if (feedErr) throw feedErr
        if (progErr) throw progErr
        if (matchErr) throw matchErr
        if (matchPlaysErr) throw matchPlaysErr

        const allWords = []
        for (const row of feedRows ?? []) {
          for (const w of row.words_fed ?? []) allWords.push(w)
        }
        // Include match-mode words in lifetime word totals.
        const myMatchPlays = (matchPlays ?? []).filter((p) => p.user_id === userId)
        for (const p of myMatchPlays) {
          for (const w of p.words_fed ?? []) allWords.push(w)
        }
        const wordAgg = aggregateWords(allWords)

        const dates = (feedRows ?? [])
          .filter((r) => (r.words_fed?.length ?? 0) > 0)
          .map((r) => r.feed_date)
        const streak = computeStreak(dates)

        const petsRaised = (progressRows ?? []).filter((p) => p.graduated_at).length

        // Multiplayer aggregates
        const matchesPlayed = matchRows?.length ?? 0
        const wins = (matchRows ?? []).filter((m) => m.winner_id === userId).length
        const ties = (matchRows ?? []).filter((m) => !m.winner_id).length
        const losses = matchesPlayed - wins - ties

        // Rounds won — for each completed match, count rounds where my
        // score beat my opponent's. Group plays by (match, round).
        let roundsWon = 0
        let totalRoundsPlayed = 0
        if (matchRows && matchRows.length > 0) {
          const completedMatchIds = new Set(matchRows.map((m) => m.id))
          const playsByMatchRound = new Map()
          for (const p of matchPlays ?? []) {
            if (!completedMatchIds.has(p.match_id)) continue
            const k = `${p.match_id}:${p.round_index}`
            const arr = playsByMatchRound.get(k) ?? []
            arr.push(p)
            playsByMatchRound.set(k, arr)
          }
          for (const [, plays] of playsByMatchRound) {
            const mine = plays.find((p) => p.user_id === userId)
            const theirs = plays.find((p) => p.user_id !== userId)
            if (!mine || !theirs) continue
            totalRoundsPlayed++
            if (mine.score > theirs.score) roundsWon++
          }
        }

        if (!active) return
        setStats({
          streak,
          totalWordsFed: allWords.length,
          longestWord: wordAgg.longest,
          favoriteWord: wordAgg.favorite,
          favoriteCount: wordAgg.favoriteCount,
          petsRaised,
          sessionCount: feedRows?.length ?? 0,
          // Multiplayer
          matchesPlayed,
          wins,
          losses,
          ties,
          roundsWon,
          totalRoundsPlayed,
        })
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useMyStats] load failed', err)
        setError(err.message || 'Failed to load stats')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId, reloadTick])

  function reload() { setReloadTick((t) => t + 1) }

  return { stats, loading, error, reload }
}

function aggregateWords(words) {
  if (!words.length) return { longest: null, favorite: null, favoriteCount: 0 }
  let longest = words[0]
  const counts = new Map()
  for (const w of words) {
    if (w.length > longest.length) longest = w
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  let favorite = null
  let favoriteCount = 0
  for (const [word, count] of counts) {
    if (count > favoriteCount || (count === favoriteCount && favorite && word.length > favorite.length)) {
      favorite = word
      favoriteCount = count
    }
  }
  return { longest, favorite, favoriteCount }
}

// Walk consecutive days backwards. If today has a feed, streak starts
// today; if not, starts at the most recent feed date (so a streak isn't
// broken until midnight rolls past).
function computeStreak(dates) {
  if (!dates.length) return 0
  const set = new Set(dates)
  const today = todayInHalifax()
  let cursor = set.has(today) ? today : dates[0]
  // If the most recent date isn't today or yesterday, the streak ended.
  if (!set.has(today)) {
    const yesterday = shiftDate(today, -1)
    if (cursor !== yesterday) return 0
  }
  let count = 0
  while (set.has(cursor)) {
    count++
    cursor = shiftDate(cursor, -1)
  }
  return count
}

function todayInHalifax() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

function shiftDate(yyyyMmDd, days) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
