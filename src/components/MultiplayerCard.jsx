// ────────────────────────────────────────────────────────────
//  MultiplayerCard — lobby section for two-player matches.
//
//  Top: "Start a match" button (creates a single-craving match
//  directly, no popup).
//  Then: completed-match result banners (persistent until dismissed,
//  capped at 10 most recent — see CompletedMatchBanner.jsx).
//  Below: active-match rows in this order:
//    1. Open (yours: "waiting for opponent")
//    2. Open (others: tap to join)
//    3. Your turn
//    4. Waiting on them
//
//  Row layout matches Wordy/Rungles exactly: white-ish row card with
//  player chips, status sub-text, action button on the right.
// ────────────────────────────────────────────────────────────

import toast from 'react-hot-toast'
import { useState } from 'react'
import { useOpenMatches } from '../hooks/useMatches.js'
import { createMatch, joinMatch } from '../lib/matchActions.js'

export default function MultiplayerCard({ user, mine, onOpenMatch }) {
  const others = useOpenMatches(user.id)
  const [joiningId, setJoiningId] = useState(null)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    try {
      await createMatch({ userId: user.id })
      toast.success('Match posted — waiting for an opponent.')
      mine.reload()
    } catch (err) {
      console.error('[createMatch] failed', err)
      toast.error(err.message || 'Failed to create match')
    } finally {
      setCreating(false)
    }
  }

  const mineRowCount =
    mine.waitingForOpponent.length +
    mine.yourTurn.length +
    mine.waitingOnThem.length
  const totalRows = mineRowCount + others.matches.length

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
    <section className="card">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-display text-xl text-wordy-700">🎮 Two-Player Match</h2>
        {mine.yourTurn.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-200 text-pink-700 ring-1 ring-pink-300">
            {mine.yourTurn.length} your turn
          </span>
        )}
      </div>
      <p className="text-sm text-wordy-600 mb-3">
        Same craving + same letters. Highest score wins.
      </p>
      <button
        onClick={handleCreate}
        disabled={creating}
        className="btn-primary text-sm font-display mb-3 disabled:opacity-60"
      >
        {creating ? '⏳ Creating…' : '✨ Start a match'}
      </button>

        {mine.loading && others.loading && (
          <p className="text-xs text-wordy-500 italic text-center py-2">Loading matches…</p>
        )}

        {!mine.loading && !others.loading && totalRows === 0 && (
          <p className="text-xs text-wordy-500 italic text-center py-2">
            No matches yet — start one or wait for someone to post one.
          </p>
        )}

        <div className="space-y-1.5">
          {!mine.loading && (
            <>
            {mine.waitingForOpponent.map((m) => (
              <MatchRow
                key={m.id}
                kind="waiting-for-opponent"
                userName={user.userMetadata?.username}
                creatorName={user.user_metadata?.username ?? 'You'}
                opponentName={null}
                action="Resume"
                onAction={() => onOpenMatch(m)}
                statusText="⏳ Waiting for opponent"
              />
            ))}
            </>
          )}

          {!others.loading && others.matches.map((m) => (
            <MatchRow
              key={m.id}
              kind="open-other"
              creatorName={m.creator.username}
              opponentName={null}
              action={joiningId === m.id ? 'Joining…' : 'Join'}
              onAction={() => handleJoin(m)}
              disabled={joiningId === m.id}
              statusText="⏳ Waiting for opponent"
            />
          ))}

          {!mine.loading && (
            <>
            {mine.yourTurn.map((m) => (
              <MatchRow
                key={m.id}
                kind="your-turn"
                creatorName={m.isCreator ? 'You' : (m.opponent?.username ?? '?')}
                opponentName={m.isCreator ? (m.opponent?.username ?? '?') : 'You'}
                youAreCreator={m.isCreator}
                youHighlight
                action="Play"
                onAction={() => onOpenMatch(m)}
                statusText={`🟢 Your turn · ${timeAgo(m.last_activity_at)}`}
              />
            ))}

            {mine.waitingOnThem.map((m) => (
              <MatchRow
                key={m.id}
                kind="waiting-on-them"
                creatorName={m.isCreator ? 'You' : (m.opponent?.username ?? '?')}
                opponentName={m.isCreator ? (m.opponent?.username ?? '?') : 'You'}
                youAreCreator={m.isCreator}
                themHighlight
                action="View"
                onAction={() => onOpenMatch(m)}
                statusText={`⏳ Waiting on ${m.opponent?.username ?? 'them'} · ${timeAgo(m.last_activity_at)}`}
              />
            ))}

            </>
          )}
        </div>
    </section>
  )
}

// One lobby row — chip strip on the left, status under, action on right.
// Classes copied verbatim from wordy/src/components/lobby/LobbyGameRow.jsx
// so Snibble's lobby rows are visually identical to Wordy's. Dark-mode
// overrides come from Wordy's index.css globals (per SQ conventions);
// don't add `dark:` variants here.
function MatchRow({
  creatorName,
  opponentName,
  youAreCreator,
  youHighlight,
  themHighlight,
  action,
  onAction,
  disabled,
  statusText,
}) {
  return (
    <div className="flex items-center justify-between bg-wordy-50 rounded-xl px-3 py-2 border border-wordy-100">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip
            name={creatorName}
            highlight={youAreCreator ? youHighlight : themHighlight}
          />
          <span className="text-xs text-wordy-400">vs</span>
          {opponentName ? (
            <Chip
              name={opponentName}
              highlight={youAreCreator ? themHighlight : youHighlight}
            />
          ) : (
            <Chip name="?" muted />
          )}
        </div>
        <p className="text-xs text-wordy-400 mt-0.5">
          {statusText}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">

        <button
          onClick={onAction}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all min-w-[5rem] btn-primary disabled:opacity-50"
        >
          {action}
        </button>
      </div>
    </div>
  )
}

// Chip classes also lifted verbatim from Wordy's LobbyGameRow.
function Chip({ name, highlight, muted }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
        highlight
          ? 'text-white bg-wordy-500'
          : muted
            ? 'text-wordy-400 bg-wordy-100'
            : 'text-wordy-700 bg-wordy-200'
      }`}
    >
      {name}
    </span>
  )
}

// "Xh ago" style relative time. Matches Wordy's lobby row.
function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}
