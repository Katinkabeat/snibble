// ────────────────────────────────────────────────────────────
//  useDailyLeaderboard — fetches today's ranked scores via the
//  sn_daily_leaderboard RPC, joins usernames from `profiles`,
//  and computes each row's percentage of today's totalSolutions.
//
//  Returns rows in rank order: { rank, userId, username, avatarHue,
//  score, wordsCount, percent, isYou }.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { generateTodaysPuzzle } from '../lib/cravingGenerator.js'

export function useDailyLeaderboard(currentUserId) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      try {
        const puzzle = await generateTodaysPuzzle()
        const today = todayInHalifax()

        const { data: lbRows, error: rpcErr } = await supabase
          .rpc('sn_daily_leaderboard', { p_date: today })
        if (rpcErr) throw rpcErr

        // Bail early if no plays today.
        if (!lbRows || lbRows.length === 0) {
          if (active) setRows([])
          return
        }

        const userIds = lbRows.map((r) => r.user_id)
        const { data: profileRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_hue')
          .in('id', userIds)
        if (profErr) throw profErr

        const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

        const ranked = lbRows.map((r, i) => {
          const profile = profileById.get(r.user_id)
          return {
            rank: i + 1,
            userId: r.user_id,
            username: profile?.username ?? 'anonymous',
            avatarHue: profile?.avatar_hue ?? null,
            score: r.score ?? 0,
            wordsCount: r.words_count ?? 0,
            wordsFed: r.words_fed ?? [],
            percent: puzzle.totalSolutions
              ? Math.round((r.words_count / puzzle.totalSolutions) * 100)
              : 0,
            isYou: r.user_id === currentUserId,
          }
        })

        if (!active) return
        setRows(ranked)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useDailyLeaderboard] load failed', err)
        setError(err.message || 'Failed to load leaderboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [currentUserId, reloadTick])

  function reload() { setReloadTick((t) => t + 1) }

  return { rows, loading, error, reload }
}

// Atlantic time (auto-handles AST/ADT). Snibble's daily seed uses the
// same timezone — keep these in sync.
function todayInHalifax() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date()) // 'YYYY-MM-DD'
}
