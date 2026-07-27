// ────────────────────────────────────────────────────────────
//  StatsPage — full-page Stats view. Mirrors Yahdle's StatsPage
//  chrome (SQLobbyShell + back-to-lobby button + tab bar) so all
//  three solo SQ games present stats the same way.
//
//  Tab 1: 🏆 Leaderboard — timeframe-aware (Day/Week/Month/All-time)
//                          with a date stepper on the Day tab.
//  Tab 2: 📊 My Stats     — streak + lifetime aggregates.
//
//  Snibble-specific bits preserved:
//    - Day-today play-to-see gate (LeaderboardLocked)
//    - Word-list expansion per row (Day tab only, hidden when locked)
//    - Percent vs. today's puzzle (Day + today only)
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { SQLobbyShell } from '../../../rae-side-quest/packages/sq-ui/index.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import { useSoloLeaderboard } from '../hooks/useSoloLeaderboard.js'
import { useMyStats } from '../hooks/useMyStats.js'
import { supabase } from '../lib/supabase.js'
import { generatePuzzle } from '../lib/cravingGenerator.js'
import { dailySeedForIso } from '../lib/rng.js'

const TIMEFRAMES = [
  { key: 'day',   label: 'Day'      },
  { key: 'week',  label: 'Week'     },
  { key: 'month', label: 'Month'    },
  { key: 'all',   label: 'All-time' },
]

const WINDOW_LABEL = {
  week:  'This week (Mon–Sun)',
  month: 'This month',
  all:   'All-time, since launch',
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
})

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

function formatIso(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return DATE_FMT.format(new Date(Date.UTC(y, m - 1, d)))
}

function todayInHalifax() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date())
}

// ─── That day's craving ──────────────────────────────────────
// The daily puzzle is a pure function of its Atlantic date — the rule
// isn't stored anywhere and there's no per-user salt — so any past
// day's craving reconstructs client-side with no schema work. Not a
// spoiler: the lobby already announces today's craving before you play.
//
// Regeneration walks the dictionary a few times, so the promise is
// cached per date; stepping back and forth only pays the cost once per
// day visited.
const cravingCache = new Map()

function cravingForDate(iso) {
  if (cravingCache.has(iso)) return cravingCache.get(iso)
  const pending = generatePuzzle(dailySeedForIso(iso))
    .then((puzzle) => ({
      text: puzzle.base.craving ?? puzzle.base.label,
      difficulty: puzzle.difficulty,
    }))
    .catch((err) => {
      // Don't cache a failure — a later visit should retry.
      cravingCache.delete(iso)
      throw err
    })
  cravingCache.set(iso, pending)
  return pending
}

export default function StatsPage({ user, defaultTab = 'leaderboard', onBack }) {
  const [tab, setTab] = useState(defaultTab)
  const [submittedToday, setSubmittedToday] = useState(null)

  // Has the user submitted today's puzzle? Gates only Day + today;
  // past days and Week/Month/All-time are always open.
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
        setSubmittedToday(!!data?.is_complete)
      })
    return () => { active = false }
  }, [user?.id])

  return (
    <SQLobbyShell header={<SnibbleHeader user={user} />}>
      <button
        onClick={onBack}
        className="text-sm opacity-80 hover:opacity-100 self-start"
      >
        ← Back to lobby
      </button>

      <div className="flex border-b border-white/10 mb-4">
        <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')}>🏆 Leaderboard</TabButton>
        <TabButton active={tab === 'mystats'}     onClick={() => setTab('mystats')}>📊 My Stats</TabButton>
      </div>

      {tab === 'leaderboard' && <LeaderboardTab user={user} submittedToday={submittedToday} />}
      {tab === 'mystats'     && <MyStatsTab user={user} />}
    </SQLobbyShell>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 font-display text-sm transition-colors ${
        active
          ? 'text-white border-b-2 border-white'
          : 'text-white/60 hover:text-white/80'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Leaderboard tab ─────────────────────────────────────────
function LeaderboardTab({ user, submittedToday }) {
  const today = useMemo(() => todayInHalifax(), [])
  const [timeframe, setTimeframe] = useState('day')
  const [activeDate, setActiveDate] = useState(today)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [craving, setCraving] = useState(null)

  useEffect(() => {
    if (timeframe !== 'day') setActiveDate(today)
    setExpandedIds(new Set())
  }, [timeframe, today])

  // Which craving was this day's board played on? Day tab only —
  // Week/Month/All-time span many rules, so there's nothing to name.
  useEffect(() => {
    if (timeframe !== 'day') return
    let active = true
    setCraving(null)
    cravingForDate(activeDate).then(
      (c)  => { if (active) setCraving(c) },
      ()   => { if (active) setCraving(null) },  // no line; board is unaffected
    )
    return () => { active = false }
  }, [timeframe, activeDate])

  const queryDate = timeframe === 'day' ? activeDate : today
  const { rows, myRank, locked, loading, error } = useSoloLeaderboard({
    timeframe,
    date: queryDate,
    currentUserId: user.id,
    todayIso: today,
  })

  const isToday = activeDate === today
  const isViewingToday = timeframe === 'day' && isToday
  const canSeeWords = timeframe === 'day' && (!isViewingToday || submittedToday === true)

  function toggleExpanded(userId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const youInTop = rows.some(r => r.userId === user.id)
  const showMyRankRow = !youInTop && myRank && myRank.rank > 10

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={TIMEFRAMES}
        value={timeframe}
        onChange={setTimeframe}
      />

      {timeframe === 'day' ? (
        <DateStepper
          isoDate={activeDate}
          isToday={isToday}
          craving={craving}
          onPrev={() => setActiveDate(addDays(activeDate, -1))}
          onNext={() => !isToday && setActiveDate(addDays(activeDate, 1))}
        />
      ) : (
        <p className="text-center text-xs opacity-60 -mt-1">{WINDOW_LABEL[timeframe]}</p>
      )}

      {loading && <p className="italic opacity-70 py-6 text-sm text-center">Loading…</p>}
      {error && <p className="text-rose-400 text-sm text-center py-6">{error}</p>}

      {!loading && !error && locked && <LeaderboardLocked />}

      {!loading && !error && !locked && rows.length === 0 && (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">🌱</p>
          <p className="opacity-80 font-display">
            {timeframe === 'day'
              ? (isToday ? "No one's played yet today." : "No plays recorded for this day.")
              : "No plays in this window yet."}
          </p>
          {isViewingToday && <p className="text-xs opacity-60 mt-2">Be the first.</p>}
        </div>
      )}

      {!loading && !error && !locked && rows.length > 0 && (
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
          {showMyRankRow && (
            <>
              <li className="pt-2 text-center text-[10px] uppercase tracking-wider opacity-50 border-t border-white/10 mt-2">
                your rank
              </li>
              <LeaderboardRow
                row={{
                  rank: myRank.rank,
                  userId: user.id,
                  username: 'You',
                  score: myRank.score,
                  wordsCount: 0,
                  wordsFed: [],
                  percent: null,
                  isYou: true,
                }}
                expanded={false}
                onToggle={() => {}}
                canSeeWords={false}
              />
            </>
          )}
        </ol>
      )}
    </div>
  )
}

function LeaderboardLocked() {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-5xl mb-3">🔒</p>
      <p className="font-display mb-2">Submit today's puzzle first</p>
      <p className="text-sm opacity-70">
        Once you've fed your pet for the day, the leaderboard reveals — and you can peek at everyone else's word lists.
      </p>
    </div>
  )
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            value === opt.key
              ? 'bg-white/15 text-white ring-1 ring-white/30'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// The stars and the craving line are both always rendered — blanked in
// place while the puzzle regenerates rather than collapsed — so the
// stepper doesn't change size or nudge the date sideways on load.
function DateStepper({ isoDate, isToday, craving, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10">
      <button
        onClick={onPrev}
        aria-label="Previous day"
        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-white shrink-0"
      >
        ‹
      </button>
      <div className="min-w-0 px-2 text-center">
        <div className="text-sm font-bold flex items-center justify-center gap-2">
          {formatIso(isoDate)}
          {isToday && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-pink-500 text-white">
              Today
            </span>
          )}
          <DifficultyStars level={craving?.difficulty} />
        </div>
        <div className="text-xs opacity-75 mt-0.5">
          {craving
            ? <>craving: <span className="font-bold">{craving.text}</span></>
            : ' '}
        </div>
      </div>
      <button
        onClick={onNext}
        disabled={isToday}
        aria-label="Next day"
        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-white disabled:opacity-30 disabled:hover:bg-white/5 disabled:cursor-not-allowed shrink-0"
      >
        ›
      </button>
    </div>
  )
}

// Same 3-star difficulty read the lobby shows next to today's craving.
// `invisible` (not unmounted) while unknown so the row keeps its width.
function DifficultyStars({ level }) {
  const filled = level ?? 0
  const name = filled === 1 ? 'easy' : filled === 2 ? 'medium' : 'hard'
  return (
    <span
      className={`text-[11px] tracking-wide shrink-0 ${level ? '' : 'invisible'}`}
      title={level ? `${name} day` : undefined}
      aria-hidden={!level}
    >
      <span className="text-amber-400">{'★'.repeat(filled)}</span>
      <span className="text-amber-400/25">{'★'.repeat(3 - filled)}</span>
    </span>
  )
}

function LeaderboardRow({ row, expanded, onToggle, canSeeWords }) {
  const isPerfect = row.percent != null && row.percent >= 100
  const hasWords = canSeeWords && Array.isArray(row.wordsFed) && row.wordsFed.length > 0
  const sortedWords = hasWords ? [...row.wordsFed].sort((a, b) => a.localeCompare(b)) : []
  return (
    <li>
      <button
        onClick={hasWords ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
          row.isYou ? 'bg-white/15 ring-1 ring-white/30' : 'bg-white/5'
        } ${hasWords ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}`}
      >
        <div className="w-9 text-center font-display text-sm">#{row.rank}</div>
        <div className="flex-1 min-w-0 truncate text-sm">
          <span className="font-bold">{row.username}</span>
          {isPerfect && <span className="ml-1" title="Found them all">✨</span>}
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div className="font-display text-sm">
            {row.score} pts
            {row.percent != null && (
              <span className="opacity-60 font-normal"> · {row.percent}%</span>
            )}
          </div>
          {hasWords && (
            <span className={`opacity-50 transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          )}
        </div>
      </button>
      {expanded && hasWords && (
        <div className="mt-1 mb-2 px-3 py-3 rounded-xl bg-white/5">
          <div className="text-[10px] uppercase tracking-wide opacity-60 mb-2">
            {sortedWords.length} word{sortedWords.length === 1 ? '' : 's'} fed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedWords.map((w) => (
              <span
                key={w}
                className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-display border border-white/20"
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

// ─── My Stats tab ────────────────────────────────────────────
function MyStatsTab({ user }) {
  const { stats, loading, error } = useMyStats(user.id)

  if (loading) return <p className="italic opacity-70 py-6 text-sm">Loading…</p>
  if (error) return <p className="text-rose-400 text-sm py-6">{error}</p>
  if (!stats) return null

  const winRate = stats.matchesPlayed > 0
    ? Math.round((stats.wins / stats.matchesPlayed) * 100)
    : 0

  return (
    <div className="space-y-5">
      <Section title="🍃 Daily play">
        <StatRow icon="🔥" label="Current streak" value={stats.streak === 0 ? '—' : `${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
        <StatRow icon="📅" label="Sessions played" value={stats.sessionCount} />
        <StatRow icon="🌟" label="Pets graduated" value={stats.petsRaised} />
      </Section>

      {stats.matchesPlayed > 0 && (
        <Section title="🎮 Multiplayer">
          <StatRow icon="🏆" label="Matches played" value={stats.matchesPlayed} />
          <StatRow
            icon="📊"
            label="Win rate"
            value={
              <>
                {winRate}% <span className="opacity-60 font-normal">({stats.wins}–{stats.losses}{stats.ties ? `–${stats.ties}` : ''})</span>
              </>
            }
          />
          <StatRow icon="🎯" label="Rounds won" value={`${stats.roundsWon} / ${stats.totalRoundsPlayed}`} />
        </Section>
      )}

      <Section title="📚 Lifetime words">
        <StatRow icon="🥕" label="Words fed" value={stats.totalWordsFed.toLocaleString()} />
        <StatRow icon="📏" label="Longest word" value={stats.longestWord ? stats.longestWord.toUpperCase() : '—'} />
        <StatRow
          icon="💜"
          label="Favorite word"
          value={stats.favoriteWord ? (
            <>
              {stats.favoriteWord.toUpperCase()}{' '}
              <span className="opacity-60 font-normal">×{stats.favoriteCount}</span>
            </>
          ) : '—'}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="font-display text-xs uppercase tracking-wider opacity-70 mb-2 px-1">{title}</h3>
      <div className="space-y-0">{children}</div>
    </section>
  )
}

function StatRow({ icon, label, value }) {
  return (
    <div className="flex justify-between items-center py-3 border-t border-white/10 text-sm first:border-t-0">
      <span className="flex items-center gap-2 opacity-80">
        <span className="text-base">{icon}</span> {label}
      </span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
