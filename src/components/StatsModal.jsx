// ────────────────────────────────────────────────────────────
//  StatsModal — two-tab modal opened from the avatar menu OR
//  popped automatically after the player hits "Done for today".
//
//  Tab 1 (default): 🏆 Daily Leaderboard — everyone today, ranked.
//  Tab 2          : 📊 My Stats — streak + lifetime aggregates.
//
//  Same pop-in animation as PetModal (cubic-bezier overshoot).
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { useDailyLeaderboard } from '../hooks/useDailyLeaderboard.js'
import { useMyStats } from '../hooks/useMyStats.js'
import { supabase } from '../lib/supabase.js'

export default function StatsModal({ user, defaultTab = 'leaderboard', onClose }) {
  const [submittedToday, setSubmittedToday] = useState(null) // null=unknown
  const [tab, setTab] = useState(defaultTab)
  const [open, setOpen] = useState(false)

  // Has the user submitted today's puzzle? Gates the leaderboard.
  useEffect(() => {
    if (!user?.id) return
    let active = true
    const today = todayInHalifax()
    supabase
      .from('sn_daily_feeds')
      .select('is_complete')
      .eq('user_id', user.id)
      .eq('feed_date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        const done = !!data?.is_complete
        setSubmittedToday(done)
        // If they haven't submitted, push them to My Stats so they
        // don't see an unhelpful locked tab.
        if (!done) setTab('mystats')
      })
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative card p-0 w-full max-w-sm flex flex-col min-h-[600px] max-h-[85vh] overflow-hidden transition-all duration-300 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 grid place-items-center rounded-full bg-wordy-100 text-wordy-700 hover:bg-wordy-200 transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        {/* Tab bar */}
        <div className="flex border-b border-wordy-100 dark:border-[#2d1b55]">
          <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>
            🏆 Today {submittedToday === false && <span className="text-xs">🔒</span>}
          </TabButton>
          <TabButton active={tab === 'mystats'} onClick={() => setTab('mystats')}>
            📊 My Stats
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'leaderboard' && (
            submittedToday === false
              ? <LeaderboardLocked />
              : <LeaderboardTab user={user} canSeeWords={submittedToday === true} />
          )}
          {tab === 'mystats' && <MyStatsTab user={user} />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 font-display text-sm transition-colors ${
        active
          ? 'text-wordy-800 dark:text-wordy-100 border-b-2 border-wordy-500'
          : 'text-wordy-500 hover:text-wordy-700 dark:hover:text-wordy-200'
      }`}
    >
      {children}
    </button>
  )
}

function LeaderboardLocked() {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-5xl mb-3">🔒</p>
      <p className="font-display text-wordy-800 dark:text-wordy-100 mb-2">
        Submit today's puzzle first
      </p>
      <p className="text-sm text-wordy-600 dark:text-wordy-300">
        Once you've fed your pet for the day, the leaderboard reveals — and you can peek at everyone else's word lists.
      </p>
    </div>
  )
}

function LeaderboardTab({ user, canSeeWords }) {
  const { rows, loading, error } = useDailyLeaderboard(user.id)
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function toggleExpanded(userId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  if (loading) return <p className="italic text-wordy-500 text-center py-6">Loading…</p>
  if (error) return <p className="text-rose-600 text-sm text-center py-6">{error}</p>
  if (!rows.length) return (
    <div className="text-center py-10">
      <p className="text-3xl mb-2">🌱</p>
      <p className="text-wordy-700 dark:text-wordy-200 font-display">No one's played yet today.</p>
      <p className="text-xs text-wordy-500 mt-2">Be the first.</p>
    </div>
  )

  return (
    <ol className="space-y-1.5">
      {rows.map((row) => (
        <LeaderboardRow
          key={row.userId}
          row={row}
          expanded={expandedIds.has(row.userId)}
          onToggle={() => toggleExpanded(row.userId)}
          canSeeWords={canSeeWords}
        />
      ))}
    </ol>
  )
}

function LeaderboardRow({ row, expanded, onToggle, canSeeWords }) {
  const isPerfect = row.percent >= 100
  const sortedWords = [...row.wordsFed].sort((a, b) => a.localeCompare(b))
  return (
    <li>
      <button
        onClick={canSeeWords ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
          row.isYou
            ? 'bg-gradient-to-r from-wordy-100 to-pink-50 dark:from-[#2d1b55] dark:to-[#3d2070] ring-2 ring-wordy-400 dark:ring-wordy-600'
            : isPerfect
              ? 'bg-amber-50 dark:bg-[#2d1b55] hover:bg-amber-100'
              : 'hover:bg-wordy-50 dark:hover:bg-[#221540]'
        } ${canSeeWords ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="w-7 text-center font-display text-sm text-wordy-700 dark:text-wordy-200">
          {medalForRank(row.rank)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-wordy-800 dark:text-wordy-100 truncate flex items-center gap-1.5">
            {row.username}
            {row.isYou && <span className="text-[10px] font-normal text-wordy-500">← you</span>}
            {isPerfect && <span title="Found them all">✨</span>}
          </div>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div className="font-display text-sm text-wordy-800 dark:text-wordy-100">
            {row.score} pts <span className="text-wordy-500 font-normal">· {row.percent}%</span>
          </div>
          {canSeeWords && (
            <span className={`text-wordy-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
              ›
            </span>
          )}
        </div>
      </button>
      {expanded && canSeeWords && (
        <div className="mt-1 mb-2 px-3 py-3 rounded-xl bg-wordy-50 dark:bg-[#1a1130]">
          <div className="text-[10px] uppercase tracking-wide text-wordy-500 mb-2">
            {sortedWords.length} word{sortedWords.length === 1 ? '' : 's'} fed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedWords.map((w) => (
              <span
                key={w}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-[#2d1b55] text-xs font-display text-wordy-800 dark:text-wordy-100 border border-wordy-200 dark:border-[#3d2070]"
              >
                {w.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

function medalForRank(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return rank
}

function MyStatsTab({ user }) {
  const { stats, loading, error } = useMyStats(user.id)

  if (loading) return <p className="italic text-wordy-500 text-center py-6">Loading…</p>
  if (error) return <p className="text-rose-600 text-sm text-center py-6">{error}</p>
  if (!stats) return null

  const winRate = stats.matchesPlayed > 0
    ? Math.round((stats.wins / stats.matchesPlayed) * 100)
    : 0

  return (
    <div className="space-y-5">
      <section>
        <h3 className="font-display text-xs uppercase tracking-wider text-wordy-500 mb-1 px-1">
          🍃 Daily play
        </h3>
        <div className="space-y-0">
          <StatRow icon="🔥" label="Current streak" value={stats.streak === 0 ? '—' : `${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
          <StatRow icon="📅" label="Sessions played" value={stats.sessionCount} />
          <StatRow icon="🌟" label="Pets graduated" value={stats.petsRaised} />
        </div>
      </section>

      {stats.matchesPlayed > 0 && (
        <section>
          <h3 className="font-display text-xs uppercase tracking-wider text-wordy-500 mb-1 px-1">
            🎮 Multiplayer
          </h3>
          <div className="space-y-0">
            <StatRow icon="🏆" label="Matches played" value={stats.matchesPlayed} />
            <StatRow
              icon="📊"
              label="Win rate"
              value={
                <>
                  {winRate}% <span className="text-wordy-400 font-normal">({stats.wins}–{stats.losses}{stats.ties ? `–${stats.ties}` : ''})</span>
                </>
              }
            />
            <StatRow
              icon="🎯"
              label="Rounds won"
              value={`${stats.roundsWon} / ${stats.totalRoundsPlayed}`}
            />
          </div>
        </section>
      )}

      <section>
        <h3 className="font-display text-xs uppercase tracking-wider text-wordy-500 mb-1 px-1">
          📚 Lifetime words
        </h3>
        <div className="space-y-0">
          <StatRow icon="🥕" label="Words fed" value={stats.totalWordsFed.toLocaleString()} />
          <StatRow
            icon="📏"
            label="Longest word"
            value={stats.longestWord ? stats.longestWord.toUpperCase() : '—'}
          />
          <StatRow
            icon="💜"
            label="Favorite word"
            value={
              stats.favoriteWord ? (
                <>
                  {stats.favoriteWord.toUpperCase()}{' '}
                  <span className="text-wordy-400 font-normal">×{stats.favoriteCount}</span>
                </>
              ) : '—'
            }
          />
        </div>
      </section>
    </div>
  )
}

function todayInHalifax() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

function StatRow({ icon, label, value }) {
  return (
    <div className="flex justify-between items-center py-3 border-t border-wordy-100 dark:border-[#2d1b55] text-sm">
      <span className="flex items-center gap-2 text-wordy-600 dark:text-wordy-300">
        <span className="text-base">{icon}</span> {label}
      </span>
      <span className="text-wordy-800 dark:text-wordy-100 font-bold">{value}</span>
    </div>
  )
}
