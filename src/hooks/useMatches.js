// ────────────────────────────────────────────────────────────
//  useMatches — the user's active + recent matches.
//
//  Returns rows partitioned into buckets matching the lobby card's
//  sort order:
//    waitingForOpponent : open matches you created, no opponent yet
//    yourTurn           : matches in_progress where YOU still owe a play
//    waitingOnThem      : matches in_progress where opponent owes a play
//    completed          : recent completed matches (last 10)
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useMatches(userId) {
  const [data, setData] = useState({
    waitingForOpponent: [],
    yourTurn: [],
    waitingOnThem: [],
    completed: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      setLoading(true)
      try {
        const { data: matches, error: matchErr } = await supabase
          .from('sn_matches')
          .select('id, status, creator_id, opponent_id, winner_id, closed_by_admin, created_at, joined_at, completed_at, last_activity_at')
          .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
          .order('last_activity_at', { ascending: false })
          .limit(50)
        if (matchErr) throw matchErr

        // Plays are needed for two reasons:
        //   1. in_progress matches → determine whose turn it is
        //   2. completed (undismissed) matches → score subtext on banner
        const playsNeededIds = (matches ?? [])
          .filter((m) => m.status === 'in_progress' || m.status === 'completed' || m.status === 'expired')
          .map((m) => m.id)

        const userIds = new Set()
        for (const m of matches ?? []) {
          userIds.add(m.creator_id)
          if (m.opponent_id) userIds.add(m.opponent_id)
        }
        userIds.delete(userId)

        // Plays + profiles both depend only on `matches` — fetch in parallel.
        const playsPromise = playsNeededIds.length > 0
          ? supabase
              .from('sn_match_round_plays')
              .select('match_id, round_index, user_id, score')
              .in('match_id', playsNeededIds)
          : Promise.resolve({ data: [], error: null })
        const profilesPromise = userIds.size > 0
          ? supabase
              .from('profiles')
              .select('id, username, avatar_hue')
              .in('id', Array.from(userIds))
          : Promise.resolve({ data: [], error: null })

        const [{ data: plays, error: playsErr }, { data: profileRows }] =
          await Promise.all([playsPromise, profilesPromise])
        if (playsErr) throw playsErr

        const playsByMatch = new Map()
        for (const p of plays ?? []) {
          const arr = playsByMatch.get(p.match_id) ?? []
          arr.push(p)
          playsByMatch.set(p.match_id, arr)
        }

        const profileById = new Map()
        for (const p of profileRows ?? []) profileById.set(p.id, p)

        const roundCount = () => 1

        const buckets = {
          waitingForOpponent: [],
          yourTurn: [],
          waitingOnThem: [],
          completed: [],
        }

        for (const m of matches ?? []) {
          const otherId = m.creator_id === userId ? m.opponent_id : m.creator_id
          const other = otherId ? profileById.get(otherId) : null
          const isCreator = m.creator_id === userId
          const enriched = {
            ...m,
            opponent: other ? { id: otherId, username: other.username, avatarHue: other.avatar_hue } : null,
            isCreator,
            youWon: m.winner_id === userId,
          }

          if (m.status === 'open') {
            buckets.waitingForOpponent.push(enriched)
          } else if (m.status === 'completed' || m.status === 'expired') {
            const plays = playsByMatch.get(m.id) ?? []
            let yourScore = 0
            let theirScore = 0
            for (const p of plays) {
              if (p.user_id === userId) yourScore += p.score ?? 0
              else theirScore += p.score ?? 0
            }
            enriched.yourScore = yourScore
            enriched.theirScore = theirScore
            buckets.completed.push(enriched)
          } else if (m.status === 'in_progress') {
            const plays = playsByMatch.get(m.id) ?? []
            const total = roundCount(m)
            const yourSubmitted = plays.filter((p) => p.user_id === userId).length
            const theirSubmitted = plays.filter((p) => p.user_id !== userId).length
            // "Your turn" if you've played fewer rounds than total AND
            // you're not strictly behind your opponent (in best-of-3,
            // you can play up through whatever round you've reached).
            if (yourSubmitted < total) {
              buckets.yourTurn.push(enriched)
            } else if (theirSubmitted < total) {
              buckets.waitingOnThem.push(enriched)
            } else {
              // Both submitted all rounds — should be 'completed' but
              // status hasn't flipped yet. Fall through to completed.
              buckets.completed.push(enriched)
            }
          }
        }

        // Cap completed at the 10 most-recent matches. No dismiss filter —
        // the section always shows the last 10 so users have a consistent
        // place to find their recent games.
        buckets.completed = buckets.completed.slice(0, 10)

        if (!active) return
        setData(buckets)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useMatches] load failed', err)
        setError(err.message || 'Failed to load matches')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId, reloadTick])

  function reload() { setReloadTick((t) => t + 1) }
  return { ...data, loading, error, reload }
}

export function useOpenMatches(currentUserId) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data: rows, error: matchErr } = await supabase
          .from('sn_matches')
          .select('id, creator_id, created_at')
          .eq('status', 'open')
          .eq('is_public', true)
          .neq('creator_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (matchErr) throw matchErr

        const userIds = (rows ?? []).map((r) => r.creator_id)
        let profileById = new Map()
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, username, avatar_hue')
            .in('id', userIds)
          for (const p of profileRows ?? []) profileById.set(p.id, p)
        }

        const enriched = (rows ?? []).map((r) => {
          const profile = profileById.get(r.creator_id)
          return {
            ...r,
            creator: profile
              ? { id: r.creator_id, username: profile.username, avatarHue: profile.avatar_hue }
              : { id: r.creator_id, username: 'anonymous', avatarHue: null },
          }
        })

        if (!active) return
        setMatches(enriched)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useOpenMatches] load failed', err)
        setError(err.message || 'Failed to load open matches')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [currentUserId, reloadTick])

  function reload() { setReloadTick((t) => t + 1) }
  return { matches, loading, error, reload }
}
