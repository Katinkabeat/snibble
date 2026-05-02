// ────────────────────────────────────────────────────────────
//  CompletedMatchBanner — persistent "you finished a match" cards
//  shown above the active-match list. Mirrors the wordy/rungles
//  pattern: gradient row with W/L emoji + score, "Result" link,
//  ✕ to dismiss. Each banner stays until the player dismisses it.
//
//  ✕ flips creator_dismissed_at OR opponent_dismissed_at on
//  sn_matches; the opponent's banner is unaffected.
// ────────────────────────────────────────────────────────────

import { useState } from 'react'
import toast from 'react-hot-toast'
import { dismissMatch } from '../lib/matchActions.js'

export default function CompletedMatchBanner({ matches, userId, onView, onDismissed }) {
  if (!matches || matches.length === 0) return null

  return (
    <div className="space-y-2 mb-3">
      {matches.map((m) => (
        <BannerRow
          key={m.id}
          match={m}
          userId={userId}
          onView={onView}
          onDismissed={onDismissed}
        />
      ))}
    </div>
  )
}

function BannerRow({ match, userId, onView, onDismissed }) {
  const [dismissing, setDismissing] = useState(false)

  const opponentName = match.opponent?.username ?? 'them'
  const headline = match.closed_by_admin
    ? '🛑 Match closed by admin'
    : match.winner_id
      ? (match.youWon ? '🏆 You won!' : `🌙 ${opponentName} won`)
      : "🤝 It's a tie!"
  const subtext = `You ${match.yourScore ?? 0} · ${opponentName} ${match.theirScore ?? 0}`

  async function handleDismiss(e) {
    e.stopPropagation()
    if (dismissing) return
    setDismissing(true)
    try {
      await dismissMatch({
        matchId: match.id,
        userId,
        isCreator: match.isCreator,
      })
      onDismissed?.()
    } catch (err) {
      console.error('[dismissMatch] failed', err)
      toast.error('Could not dismiss — try again.')
      setDismissing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-gradient-to-r from-wordy-100 to-pink-50 border border-wordy-200 dark:from-wordy-900/40 dark:to-pink-900/30 dark:border-wordy-700">
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-wordy-700 dark:text-wordy-100 truncate">
          {headline}
        </div>
        <div className="text-xs text-wordy-500 dark:text-wordy-300 truncate">
          {subtext}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onView(match)}
        className="shrink-0 text-xs font-bold text-wordy-700 dark:text-wordy-200 underline hover:no-underline"
      >
        Result
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Dismiss result"
        className="shrink-0 w-7 h-7 rounded-full text-wordy-500 hover:text-wordy-700 hover:bg-white/60 dark:text-wordy-300 dark:hover:bg-black/20 flex items-center justify-center text-sm disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  )
}
