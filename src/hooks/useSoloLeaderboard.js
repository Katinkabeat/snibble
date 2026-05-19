// ────────────────────────────────────────────────────────────
//  useSoloLeaderboard — fetches a timeframe-aware leaderboard
//  via sn_solo_leaderboard + sn_solo_my_rank RPCs, joins
//  usernames from `profiles`, and (for Day-today only) computes
//  each row's percentage of today's totalSolutions.
//
//  For Day + today, the RPC may return zero rows due to the
//  server-side play-to-see gate — surfaced as { locked: true }.
//
//  Returns { rows, myRank, locked, loading, error, reload }.
//  Each row: { rank, userId, username, avatarHue, score,
//             wordsCount, wordsFed, percent | null, isYou }.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { generateTodaysPuzzle } from '../lib/cravingGenerator.js'

export function useSoloLeaderboard({ timeframe, date, currentUserId, todayIso }) {
  const [rows, setRows] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      setLocked(false)
      try {
        // Percent vs. today's puzzle only makes sense for Day + today.
        const wantsPercent = timeframe === 'day' && date === todayIso
        const puzzle = wantsPercent ? await generateTodaysPuzzle() : null

        const [lbRes, rankRes] = await Promise.all([
          supabase.rpc('sn_solo_leaderboard', { p_timeframe: timeframe, p_date: date }),
          supabase.rpc('sn_solo_my_rank',     { p_timeframe: timeframe, p_date: date }),
        ])
        if (lbRes.error)   throw lbRes.error
        if (rankRes.error) throw rankRes.error

        const lbRows = lbRes.data ?? []
        const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data

        // Empty result for Day + today = play-to-see gate triggered.
        if (timeframe === 'day' && date === todayIso && lbRows.length === 0) {
          if (active) {
            setLocked(true)
            setRows([])
            setMyRank(null)
          }
          return
        }

        let ranked = []
        if (lbRows.length > 0) {
          const userIds = lbRows.map((r) => r.user_id)
          const { data: profileRows, error: profErr } = await supabase
            .from('profiles')
            .select('id, username, avatar_hue')
            .in('id', userIds)
          if (profErr) throw profErr

          const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

          ranked = lbRows.map((r, i) => {
            const profile = profileById.get(r.user_id)
            return {
              rank: i + 1,
              userId: r.user_id,
              username: profile?.username ?? 'anonymous',
              avatarHue: profile?.avatar_hue ?? null,
              score: r.score ?? 0,
              wordsCount: r.words_count ?? 0,
              wordsFed: r.words_fed ?? [],
              percent: wantsPercent && puzzle?.totalSolutions
                ? Math.round((r.words_count / puzzle.totalSolutions) * 100)
                : null,
              isYou: r.user_id === currentUserId,
            }
          })
        }

        if (!active) return
        setRows(ranked)
        setMyRank(rankRow ?? null)
      } catch (err) {
        if (!active) return
        console.error('[useSoloLeaderboard] load failed', err)
        setError(err.message || 'Failed to load leaderboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [timeframe, date, todayIso, currentUserId, reloadTick])

  function reload() { setReloadTick((t) => t + 1) }

  return { rows, myRank, locked, loading, error, reload }
}
