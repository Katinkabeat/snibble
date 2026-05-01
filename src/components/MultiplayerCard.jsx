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
//
//  Row layout matches Wordy/Rungles exactly: white-ish row card with
//  player chips, format/status sub-text, action button on the right.
// ────────────────────────────────────────────────────────────

import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { useMatches, useOpenMatches } from '../hooks/useMatches.js'
import { joinMatch } from '../lib/matchActions.js'
import { supabase } from '../lib/supabase.js'

export default function MultiplayerCard({ user, onCreateMatch, onOpenMatch }) {
  const mine = useMatches(user.id)
  const others = useOpenMatches(user.id)
  const [joiningId, setJoiningId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => active && setIsAdmin(!!data))
    return () => { active = false }
  }, [user?.id])

  async function handleCancel(match) {
    if (cancellingId) return
    if (!window.confirm('Delete this match? This cannot be undone.')) return
    setCancellingId(match.id)
    try {
      const { error } = await supabase.from('sn_matches').delete().eq('id', match.id)
      if (error) throw error
      toast.success('Match deleted.')
      mine.reload?.()
      others.reload?.()
    } catch (err) {
      toast.error(err.message || 'Failed to delete match')
    } finally {
      setCancellingId(null)
    }
  }

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
      <button onClick={onCreateMatch} className="btn-primary text-sm font-display mb-3">
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
            {mine.waitingForOpponent.map((m) => (
              <MatchRow
                key={m.id}
                kind="waiting-for-opponent"
                userName={user.userMetadata?.username}
                creatorName={user.user_metadata?.username ?? 'You'}
                opponentName={null}
                format={m.format}
                action="Resume"
                onAction={() => onOpenMatch(m)}
                statusText="⏳ Waiting for opponent"
                showAdminCancel={isAdmin}
                cancelling={cancellingId === m.id}
                onAdminCancel={() => handleCancel(m)}
              />
            ))}

            {others.matches.map((m) => (
              <MatchRow
                key={m.id}
                kind="open-other"
                creatorName={m.creator.username}
                opponentName={null}
                format={m.format}
                action={joiningId === m.id ? 'Joining…' : 'Join'}
                onAction={() => handleJoin(m)}
                disabled={joiningId === m.id}
                statusText="⏳ Waiting for opponent"
                showAdminCancel={isAdmin}
                cancelling={cancellingId === m.id}
                onAdminCancel={() => handleCancel(m)}
              />
            ))}

            {mine.yourTurn.map((m) => (
              <MatchRow
                key={m.id}
                kind="your-turn"
                creatorName={m.isCreator ? 'You' : (m.opponent?.username ?? '?')}
                opponentName={m.isCreator ? (m.opponent?.username ?? '?') : 'You'}
                youAreCreator={m.isCreator}
                youHighlight
                format={m.format}
                action="Play"
                onAction={() => onOpenMatch(m)}
                statusText={`🟢 Your turn · ${timeAgo(m.last_activity_at)}`}
                showAdminCancel={isAdmin}
                cancelling={cancellingId === m.id}
                onAdminCancel={() => handleCancel(m)}
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
                format={m.format}
                action="View"
                onAction={() => onOpenMatch(m)}
                statusText={`⏳ Waiting on ${m.opponent?.username ?? 'them'} · ${timeAgo(m.last_activity_at)}`}
                showAdminCancel={isAdmin}
                cancelling={cancellingId === m.id}
                onAdminCancel={() => handleCancel(m)}
              />
            ))}

            {mine.completed.slice(0, 5).map((m) => (
              <MatchRow
                key={m.id}
                kind="completed"
                creatorName={m.isCreator ? 'You' : (m.opponent?.username ?? '?')}
                opponentName={m.isCreator ? (m.opponent?.username ?? '?') : 'You'}
                youAreCreator={m.isCreator}
                format={m.format}
                action="Result"
                onAction={() => onOpenMatch(m)}
                statusText={
                  m.youWon
                    ? '🏆 You won'
                    : m.winner_id
                      ? '🌙 They won'
                      : '🤝 Tied'
                }
              />
            ))}
          </div>
        )}
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
  format,
  action,
  onAction,
  disabled,
  statusText,
  showAdminCancel,
  cancelling,
  onAdminCancel,
}) {
  const formatLabel = format === 'best_of_3' ? 'Best of 3' : 'Single'
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
          {formatLabel} · {statusText}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {showAdminCancel && (
          <button
            onClick={onAdminCancel}
            disabled={cancelling}
            title="Admin: delete this match"
            className="text-xs px-2 py-1.5 rounded-lg font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            {cancelling ? '…' : '🗑'}
          </button>
        )}
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
