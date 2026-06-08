// ────────────────────────────────────────────────────────────
//  MultiplayerCard — lobby section for two-player matches.
//
//  Top: "Start a match" button (opens CreateMatchSheet — open vs
//  with-a-friend modes).
//  Then: completed-match result banners (last 10, in their own
//  CompletedMatchesSection rendered by LobbyView).
//  Below: active-match rows in this order:
//    1. Invited to you (your friend invited you to play)
//    2. Open (yours: "waiting for opponent", with ✕ to cancel)
//    3. Open (others: tap to join)
//    4. Your turn
//    5. Waiting on them
//
//  Row layout matches Wordy/Rungles exactly: white-ish row card with
//  player chips, status sub-text, action button on the right.
// ────────────────────────────────────────────────────────────

import toast from 'react-hot-toast'
import { useState } from 'react'
import { useOpenMatches } from '../hooks/useMatches.js'
import { joinMatch, cancelMatch, declineInvite } from '../lib/matchActions.js'
import CreateMatchSheet from './CreateMatchSheet.jsx'
import { timeAgo } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function MultiplayerCard({ user, mine, onOpenMatch }) {
  const others = useOpenMatches(user.id)
  const [joiningId, setJoiningId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [decliningId, setDecliningId] = useState(null)
  const [showSheet, setShowSheet] = useState(false)

  const mineRowCount =
    mine.invitedToYou.length +
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

  async function handleDecline(match) {
    if (decliningId) return
    if (!confirm('Decline this invite?')) return
    setDecliningId(match.id)
    try {
      await declineInvite({ matchId: match.id })
      toast.success('Invite declined.')
      mine.reload()
    } catch (err) {
      console.error('[declineInvite] failed', err)
      toast.error(err.message || 'Failed to decline invite')
    } finally {
      setDecliningId(null)
    }
  }

  async function handleCancel(match) {
    if (cancellingId) return
    if (!confirm('Cancel this match?')) return
    setCancellingId(match.id)
    try {
      await cancelMatch({ matchId: match.id })
      toast.success('Match cancelled.')
      mine.reload()
    } catch (err) {
      console.error('[cancelMatch] failed', err)
      toast.error(err.message || 'Failed to cancel match')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <section className="card">
      <h2 className="font-display text-xl text-wordy-700 mb-1">🎮 Two-Player Match</h2>
      <p className="text-sm text-wordy-600 mb-3">
        Same craving + same letters. Highest score wins.
      </p>
      <button
        onClick={() => setShowSheet(true)}
        className="btn-primary text-sm font-display mb-3"
      >
        ✨ Start a match
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
          {!mine.loading && mine.invitedToYou.map((m) => (
            <MatchRow
              key={m.id}
              creatorName={m.opponent?.username ?? '?'}
              opponentName="You"
              themHighlight
              action="Accept"
              onAction={() => handleJoin(m)}
              statusText={`📨 ${m.opponent?.username ?? 'A friend'} invited you`}
              actionVariant="invite"
              onDecline={() => handleDecline(m)}
              declineDisabled={decliningId === m.id}
            />
          ))}

          {!mine.loading && mine.waitingForOpponent.map((m) => {
            const isInvite = m.invited_user_id != null
            const inviteeName = m.invitee?.username
            return (
              <MatchRow
                key={m.id}
                creatorName="You"
                opponentName={isInvite ? (inviteeName ?? 'friend') : null}
                youAreCreator
                youHighlight
                statusText={
                  isInvite
                    ? `📨 Invited ${inviteeName ?? 'friend'}`
                    : '⏳ Waiting for opponent'
                }
                onCancel={() => handleCancel(m)}
                cancelDisabled={cancellingId === m.id}
              />
            )
          })}

          {!others.loading && others.matches.map((m) => (
            <MatchRow
              key={m.id}
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

      {showSheet && (
        <CreateMatchSheet
          user={user}
          onClose={() => setShowSheet(false)}
          onCreated={() => {
            setShowSheet(false)
            mine.reload()
          }}
        />
      )}
    </section>
  )
}

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
  onCancel,
  cancelDisabled,
  onDecline,
  declineDisabled,
  actionVariant,
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
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={cancelDisabled}
            className="w-7 h-7 grid place-items-center rounded-full text-wordy-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors"
            aria-label="Cancel match"
            title="Cancel match"
          >
            ✕
          </button>
        )}
        {onDecline && (
          <button
            onClick={onDecline}
            disabled={declineDisabled}
            className="w-7 h-7 grid place-items-center rounded-full text-wordy-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition-colors"
            aria-label="Decline invite"
            title="Decline invite"
          >
            ✕
          </button>
        )}
        {action && (
          <button
            onClick={onAction}
            disabled={disabled}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all min-w-[5rem] disabled:opacity-50 ${
              actionVariant === 'invite' ? 'btn-primary bg-amber-500 hover:bg-amber-600' : 'btn-primary'
            }`}
          >
            {action}
          </button>
        )}
      </div>
    </div>
  )
}

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
