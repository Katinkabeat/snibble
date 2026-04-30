// ────────────────────────────────────────────────────────────
//  useStreak — current consecutive-day streak for the user.
//
//  A streak day = a sn_daily_feeds row with at least one word fed.
//  Counts back from today (or yesterday if today not played yet),
//  so the streak doesn't break until midnight Atlantic passes.
//
//  Lightweight: only selects feed_date, so this is cheap to call
//  on the lobby alongside the other initial queries.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useStreak(userId) {
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      try {
        const { data, error } = await supabase
          .from('sn_daily_feeds')
          .select('feed_date, words_fed')
          .eq('user_id', userId)
          .order('feed_date', { ascending: false })
          .limit(120) // 4 months back is plenty for any reasonable streak
        if (error) throw error

        const dates = (data ?? [])
          .filter((r) => (r.words_fed?.length ?? 0) > 0)
          .map((r) => r.feed_date)

        if (active) setStreak(computeStreak(dates))
      } catch (err) {
        console.error('[useStreak] load failed', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId])

  return { streak, loading }
}

function computeStreak(dates) {
  if (!dates.length) return 0
  const set = new Set(dates)
  const today = todayInHalifax()
  let cursor
  if (set.has(today)) {
    cursor = today
  } else {
    const yesterday = shiftDate(today, -1)
    if (!set.has(yesterday)) return 0
    cursor = yesterday
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
