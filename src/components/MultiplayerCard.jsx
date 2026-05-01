// ────────────────────────────────────────────────────────────
//  MultiplayerCard — lobby section for two-player matches.
//
//  Top: "Start a match" button (opens CreateMatchSheet).
//  Below: unified list of matches:
//    1. Open (yours: "waiting for opponent")
//    2. Open (others: tap to join)
//    3. Your turn
//    4. Waiting on them
//    5. Recent completed
// ────────────────────────────────────────────────────────────

import toast from 'react-hot-toast'
import { useState } from 'react'
import { useMatches, useOpenMatches } from '../hooks/useMatches.js'
import { joinMatch } from '../lib/matchActions.js'

export default function MultiplayerCard({ user, onCreateMatch, onOpenMatch }) {
  const mine = useMatches(user.id)
  const others = useOpenMatches(user.id)
  const [joiningId, setJoiningId] = useState(null)

  const loading = mine.loading || others.loading
  const totalRows =
    mine.waitingForOpponent.length +
    others.matches.length +
    mine.yourTurn.length +
    mine.waitingOnThem.length +
    Math.min(mine.completed.length, 5)

  async function handleJoin(match) {
    if (joiningId) return
    setJoiningId(match.id)
    try {
      const joined = await joinMatch({ matchId: match.id, userId: user.id })
      toast.success(`Joined ${match.creator?.username ?? 'match'}.`)
      onOpenMatch(joined)
    } catch (err) {
      console.error('[joinMatch] failed', err)
      toast.error(err.message || 'Failed to join match')
      others.reload()
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <section>
      <h2 className="font-display text-xl text-wordy-700 mb-2 px-1">🎮 Two-Player Match</h2>

      <div className="card p-4">
        <button onClick={onCreateMatch} className="btn-primary w-full text-sm font-display mb-3">
          ✨ Start a match
        </button>

        {loading && (
          <p className="text-xs text-wordy-500 italic text-center py-2">Loading matches…</p>
        )}

        {!loading && totalRows === 0 && (
          <p className="text-xs text-wordy-500 italic text-center py-2">
            No matches yet — start one or wait for someone to post one.
          </p>
        )}

        {!loading && (
          <div className="space-y-1.5">
            {/* Yours, awaiting opponent */}
            {mine.waitingForOpponent.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                status="waiting-for-opponent"
                onClick={() => onOpenMatch(m)}
              />
            ))}

            {/* Others' open matches — joinable */}
            {others.matches.map((m) => (
              <button
                key={m.id}
                disabled={joiningId === m.id}
                onClick={() => handleJoin(m)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-wordy-50 dark:bg-[#221540] hover:bg-wordy-100 dark:hover:bg-[#2d1b55] text-left transition-colors disabled:opacity-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-wordy-800 dark:text-wordy-100 truncate">
                    {m.creator.username}
                  </div>
                  <div className="text-[11px] text-wordy-500">
                    {m.format === 'best_of_3' ? 'Best of 3' : 'Single round'}
                  </div>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-pink-100 text-pink-700 ring-1 ring-pink-300">
                  {joiningId === m.id ? 'Joining…' : 'Join →'}
                </span>
              </button>
            ))}

            {/* Your turn */}
            {mine.yourTurn.map((m) => (
              <MatchRow key={m.id} match={m} status="your-turn" onClick={() => onOpenMatch(m)} />
            ))}

            {/* Waiting on them */}
            {mine.waitingOnThem.map((m) => (
              <MatchRow key={m.id} match={m} status="waiting-on-them" onClick={() => onOpenMatch(m)} />
            ))}

            {/* Recent completed */}
            {mine.completed.slice(0, 5).map((m) => (
              <MatchRow key={m.id} match={m} status="completed" onClick={() => onOpenMatch(m)} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function MatchRow({ match, status, onClick }) {
  const opponentName = match.opponent?.username ?? '???'
  const formatLabel = match.format === 'best_of_3' ? 'Best of 3' : 'Single round'

  let statusLabel, pillClass
  if (status === 'waiting-for-opponent') {
    statusLabel = 'Waiting for opponent'
    pillClass = 'bg-wordy-100 text-wordy-700'
  } else if (status === 'your-turn') {
    statusLabel = 'Your turn'
    pillClass = 'bg-pink-100 text-pink-700 ring-1 ring-pink-300'
  } else if (status === 'waiting-on-them') {
    statusLabel = 'Waiting on them'
    pillClass = 'bg-wordy-100 text-wordy-500'
  } else if (status === 'completed') {
    statusLabel = match.youWon ? 'You won' : match.winner_id ? 'You lost' : 'Tie'
    pillClass = match.youWon ? 'bg-amber-100 text-amber-700' : 'bg-wordy-100 text-wordy-500'
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left bg-wordy-50 dark:bg-[#221540] hover:bg-wordy-100 dark:hover:bg-[#2d1b55] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-wordy-800 dark:text-wordy-100 truncate">
          vs. {status === 'waiting-for-opponent' ? '???' : opponentName}
        </div>
        <div className="text-[11px] text-wordy-500">{formatLabel}</div>
      </div>
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${pillClass}`}>
        {statusLabel}
      </span>
    </button>
  )
}
