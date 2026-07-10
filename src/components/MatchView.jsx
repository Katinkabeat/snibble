// ────────────────────────────────────────────────────────────
//  MatchView — async head-to-head match screen.
//
//  Supports both single round and best-of-3. Best-of-3 reveals one
//  craving at a time: round N+1 unlocks for a player only after they
//  submit round N. Per-round results show as soon as BOTH players
//  have submitted that round.
//
//  Branches:
//    open                : waiting for opponent
//    in_progress, your turn (round N) : round-play UI for round N
//    in_progress, you submitted round N, more rounds left : "ready
//                                          for round N+1" prompt
//    in_progress, you finished all rounds, opponent hasn't : waiting
//    completed            : full scoreboard, round-by-round breakdown
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { isValidWord } from '../lib/dictionary.js'
import { matcherFromBaseIds, submitMatchRound, createMatch, claimMatchWin, joinMatch, forfeitMatch } from '../lib/matchActions.js'
import { scoreWord } from '../lib/cravingGenerator.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import BuiltWordRow from './BuiltWordRow.jsx'
import {
  SQBoardShell, SQBoardHeader, SQSettingsRow,
  isNudgeEnabled, postNudge, nudgeFailureMessage,
} from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function MatchView({ user, matchId, onBack, onOpenMatch }) {
  const [match, setMatch] = useState(null)
  const [rounds, setRounds] = useState([])
  const [plays, setPlays] = useState([])  // all plays (mine + theirs, all rounds)
  const [opponent, setOpponent] = useState(null)
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [forfeiting, setForfeiting] = useState(false)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [
          { data: m, error: mErr },
          { data: rRows, error: rErr },
          { data: pRows, error: pErr },
        ] = await Promise.all([
          supabase.from('sn_matches').select('*').eq('id', matchId).single(),
          supabase.from('sn_match_rounds').select('*').eq('match_id', matchId).order('round_index', { ascending: true }),
          supabase.from('sn_match_round_plays').select('*').eq('match_id', matchId),
        ])
        if (mErr) throw mErr
        if (rErr) throw rErr
        if (pErr) throw pErr

        const userIds = [m.creator_id, m.opponent_id].filter(Boolean)
        const { data: profileRows } = await supabase
          .from('profiles').select('id, username, avatar_hue').in('id', userIds)
        const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

        if (!active) return
        setMatch(m)
        setRounds(rRows ?? [])
        setPlays(pRows ?? [])
        setCreator(profileById.get(m.creator_id) ?? null)
        setOpponent(m.opponent_id ? profileById.get(m.opponent_id) ?? null : null)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[MatchView] load failed', err)
        setError(err.message || 'Failed to load match')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [matchId, user.id, reloadTick])

  const refresh = () => setReloadTick((t) => t + 1)

  // Realtime — refresh when this match row changes (opponent joined,
  // status flipped, completion) or when a play is inserted for this
  // match (opponent submitted). Without this, the screen stays frozen
  // until the user navigates away and back.
  useEffect(() => {
    if (!matchId) return
    let pollInterval = null
    const channel = supabase
      .channel(`match_${matchId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sn_matches',
          filter: `id=eq.${matchId}` }, refresh)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sn_match_round_plays',
          filter: `match_id=eq.${matchId}` }, refresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!pollInterval) pollInterval = setInterval(refresh, 30000)
        } else if (status === 'SUBSCRIBED' && pollInterval) {
          clearInterval(pollInterval); pollInterval = null
        }
      })
    return () => {
      if (pollInterval) clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [matchId])
  const otherProfile = match
    ? (match.creator_id === user.id ? opponent : creator)
    : null
  const opponentName = otherProfile?.username ?? 'opponent'
  const myProfile = match
    ? (match.creator_id === user.id ? creator : opponent)
    : null
  const myName = myProfile?.username ?? 'you'

  // Auto-accept invite when the invited user deep-links into an open
  // match (typically via push notification). Without this, MatchView
  // would just show the generic "waiting for someone to join" panel
  // even though THIS user is the one supposed to join.
  const autoJoiningRef = useRef(false)
  useEffect(() => {
    if (!match || autoJoiningRef.current) return
    if (match.status !== 'open') return
    if (match.invited_user_id !== user.id) return
    autoJoiningRef.current = true
    joinMatch({ matchId: match.id, userId: user.id })
      .then(() => {
        toast.success('Invite accepted!')
        refresh()
      })
      .catch((err) => {
        console.error('[MatchView] auto-join failed', err)
        toast.error(err.message || 'Failed to accept invite')
        autoJoiningRef.current = false
      })
  }, [match, user.id])

  // Per-round play lookups
  const myPlays = plays.filter((p) => p.user_id === user.id)
  const theirPlays = plays.filter((p) => p.user_id !== user.id)
  const myRoundsDone = myPlays.length
  const theirRoundsDone = theirPlays.length
  const totalRounds = rounds.length

  // Current round-to-play = the next round_index without my submission.
  const currentRound = rounds.find(
    (r) => !myPlays.some((p) => p.round_index === r.round_index)
  )

  // Claim win — for a match stalled 7+ days. Shown in the cog like the
  // other SQ games: always visible during an active match, disabled until
  // claimable (you've submitted everything and the opponent has gone quiet
  // for 7+ days). last_activity_at resets on any submission.
  const lastActivityMs = match?.last_activity_at ? new Date(match.last_activity_at).getTime() : Date.now()
  const matchAgeDays = (Date.now() - lastActivityMs) / (1000 * 60 * 60 * 24)
  const canClaim = !!match && match.status === 'in_progress' && !currentRound && matchAgeDays >= 7
  async function handleClaim() {
    if (claiming || !match) return
    setClaiming(true)
    try {
      await claimMatchWin({ matchId: match.id, userId: user.id })
      toast.success('Match claimed.')
      refresh()
    } catch (err) {
      console.error('[claimMatchWin] failed', err)
      toast.error(err.message || 'Failed to claim match')
    } finally {
      setClaiming(false)
    }
  }

  // Forfeit — concede the match; the opponent is declared the winner.
  async function handleForfeit() {
    if (forfeiting || !match) return
    if (!window.confirm('Forfeit this match? Your opponent will be declared the winner.')) return
    setForfeiting(true)
    try {
      const opponentId = match.creator_id === user.id ? match.opponent_id : match.creator_id
      await forfeitMatch({ matchId: match.id, opponentId })
      toast.success('Match forfeited.')
      refresh()
    } catch (err) {
      console.error('[forfeitMatch] failed', err)
      toast.error(err.message || 'Failed to forfeit')
    } finally {
      setForfeiting(false)
    }
  }

  // Game-specific cog rows (Claim win / Forfeit), injected into the shared
  // settings menu only while the match is in progress with both players
  // present — matches the cross-game cog pattern (c201).
  const cogGameRows = (match && match.status === 'in_progress' && match.opponent_id)
    ? (close) => (
        <>
          <SQSettingsRow
            label="Claim win (opponent inactive)"
            disabled={!canClaim || claiming}
            title={canClaim
              ? 'Claim the win — opponent inactive 7+ days'
              : 'Available once your opponent has been inactive for 7 days'}
            onClick={() => { close(); handleClaim() }}
          />
          <SQSettingsRow
            label="Forfeit game"
            danger
            onClick={() => { close(); handleForfeit() }}
          />
        </>
      )
    : null

  return (
    <SQBoardShell
      width="narrow"
      header={<SnibbleHeader user={user} gameRows={cogGameRows} />}
      subHeader={<SQBoardHeader backLabel="← Lobby" onBackClick={onBack} />}
    >
      {loading && <p className="italic text-wordy-500 text-center py-12">Loading match…</p>}
      {error && <p className="text-rose-600 text-sm text-center py-12">{error}</p>}

      {!loading && !error && match && (
        <>
          {match.status === 'open' && match.invited_user_id === user.id && (
            <div className="card p-6 text-center">
              <p className="text-4xl mb-3">📨</p>
              <p className="font-display text-lg text-wordy-800 dark:text-wordy-100">Accepting invite…</p>
              <p className="text-sm text-wordy-600 dark:text-wordy-300 mt-2">One sec, joining the match.</p>
            </div>
          )}
          {match.status === 'open' && match.invited_user_id !== user.id && <OpenMatchPanel match={match} />}

          {match.status === 'in_progress' && currentRound && (
            <RoundPlayPanel
              user={user}
              match={match}
              round={currentRound}
              opponentName={opponentName}
              myName={myName}
              totalRounds={totalRounds}
              completedRounds={resolvedRounds(rounds, myPlays, theirPlays, user.id)}
              onSubmitted={refresh}
            />
          )}

          {match.status === 'in_progress' && !currentRound && (
            <WaitingForOpponentPanel
              user={user}
              match={match}
              opponentName={opponentName}
              myName={myName}
              myPlays={myPlays}
              theirPlays={theirPlays}
              rounds={rounds}
              userId={user.id}
              onClaimed={refresh}
            />
          )}

          {match.status === 'completed' && (
            <CompletedPanel
              user={user}
              match={match}
              rounds={rounds}
              myPlays={myPlays}
              theirPlays={theirPlays}
              opponentName={opponentName}
              onRematch={onOpenMatch}
              onBack={onBack}
            />
          )}
        </>
      )}
    </SQBoardShell>
  )
}

// ───────── Helpers ─────────

// Returns an array of resolved-round summaries for display:
// { roundIndex, mine, theirs, mineWon, totalSolutions }
function resolvedRounds(rounds, myPlays, theirPlays, userId) {
  const out = []
  for (const round of rounds) {
    const mine = myPlays.find((p) => p.round_index === round.round_index)
    const theirs = theirPlays.find((p) => p.round_index === round.round_index)
    if (!mine || !theirs) continue  // not yet resolved
    const mineWon = mine.score > theirs.score
    out.push({ roundIndex: round.round_index, mine, theirs, mineWon, totalSolutions: round.total_solutions })
  }
  return out
}

// ───────── Panels ─────────

function OpenMatchPanel({ match }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-4xl mb-3">🪧</p>
      <p className="font-display text-lg text-wordy-800 dark:text-wordy-100">Match posted</p>
      <p className="text-sm text-wordy-600 dark:text-wordy-300 mt-2">
        Waiting for someone to join from their lobby's match list.
      </p>
      <p className="text-xs text-wordy-500 mt-3 italic">
        Single round
      </p>
    </div>
  )
}

function WaitingForOpponentPanel({ user, match, opponentName, myName, myPlays, theirPlays, rounds, onClaimed }) {
  const totalRounds = rounds.length
  const [nudging, setNudging] = useState(false)
  const [justNudged, setJustNudged] = useState(false)

  // Stalled = match's last_activity_at older than 7 days. We use it
  // (not joined_at) so the clock resets every time anyone submits.
  const lastActivity = match.last_activity_at
    ? new Date(match.last_activity_at).getTime()
    : Date.now()
  const ageDays = (Date.now() - lastActivity) / (1000 * 60 * 60 * 24)
  const daysUntilClaim = Math.max(0, Math.ceil(7 - ageDays))

  // Nudge: 12h cooldowns on both last_activity (don't nudge a fresh
  // turn) and last_nudged_at (don't double-nudge). Server enforces
  // these too; the UI just hides the button so users don't spam-tap.
  const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000
  const lastNudged = match.last_nudged_at ? new Date(match.last_nudged_at).getTime() : 0
  const turnAge = Date.now() - lastActivity
  const nudgeAge = Date.now() - lastNudged
  const nudgeEligible = !justNudged && turnAge > NUDGE_COOLDOWN_MS && nudgeAge > NUDGE_COOLDOWN_MS

  // Snibble is 1v1, so there's exactly one person a nudge could reach — no
  // fan-out needed, just the one pref. null = not loaded yet; the button
  // stays hidden until it resolves (c259).
  const opponentId = match.creator_id === user.id ? match.opponent_id : match.creator_id
  const [nudgeAllowed, setNudgeAllowed] = useState(null)
  useEffect(() => {
    if (!nudgeEligible || !opponentId) { setNudgeAllowed(null); return }
    let cancelled = false
    isNudgeEnabled(supabase, opponentId, 'snibble')
      .then(ok => { if (!cancelled) setNudgeAllowed(ok) })
    return () => { cancelled = true }
  }, [nudgeEligible, opponentId])

  const canNudge = nudgeEligible && nudgeAllowed === true

  async function handleNudge() {
    if (nudging || !canNudge) return
    setNudging(true)
    try {
      // Server-side cooldown + caller-must-have-submitted check, returns target uuid.
      const { data: targetId, error } = await supabase.rpc('sn_nudge', { p_match_id: match.id })
      if (error) throw error
      if (!targetId) throw new Error('No opponent to nudge')

      // The push IS the nudge — await it so a dropped POST surfaces instead
      // of a false "sent" toast (c239), and read the 200 body rather than
      // res.ok, since the edge fn answers 200 { sent: false } when the
      // recipient is opted out or has no push subscription (c259).
      //
      // NOTE: sn_nudge stamps last_nudged_at itself, before we get here, so an
      // undelivered nudge still burns the 12h cooldown. Wordy and Yahdle stamp
      // only after a confirmed delivery; splitting sn_nudge into validate +
      // mark to match needs a migration and is tracked separately.
      const { delivered, reason } = await postNudge({
        url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/snibble-push-notification`,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        reportUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sq-report-client-error`,
        game: 'snibble',
        body: {
          type: 'nudge',
          match_id: match.id,
          target_user_id: targetId,
          nudger_name: myName,
        },
      })
      if (!delivered) throw new Error(nudgeFailureMessage(reason))

      setJustNudged(true)
      toast.success('🔔 Reminder sent!')
    } catch (err) {
      const msg = err.message || String(err)
      // Translate the RPC's error messages into nicer UI copy.
      if (msg.includes('too fresh')) toast.error('Give them a chance — try again in a few hours.')
      else if (msg.includes('already nudged')) toast.error('You already nudged recently.')
      else toast.error(msg)
    } finally {
      setNudging(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-6 text-center">
        <p className="text-4xl mb-3">⏳</p>
        <p className="font-display text-lg text-wordy-800 dark:text-wordy-100">
          Waiting on {opponentName}
        </p>
        <p className="text-sm text-wordy-600 dark:text-wordy-300 mt-2">
          {totalRounds === 1
            ? 'Your round is locked in.'
            : `You've finished all ${totalRounds} rounds.`}
        </p>
        {canNudge ? (
          <button
            onClick={handleNudge}
            disabled={nudging}
            className="mt-4 text-sm font-bold text-wordy-700 bg-white border-2 border-wordy-200 hover:border-wordy-400 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {nudging ? '…' : '🔔 Nudge opponent'}
          </button>
        ) : (
          <p className="text-[11px] text-wordy-500 mt-3 italic">
            {justNudged
              ? 'Reminder sent.'
              : nudgeEligible
                // Nudgeable on the clock, but a reminder can't reach them. Say
                // nothing about why — their notification settings are theirs.
                ? `You can claim the win after 7 days (${daysUntilClaim} day${daysUntilClaim === 1 ? '' : 's'} left).`
                : `You can nudge after 12 hours, or claim the win after 7 days (${daysUntilClaim} day${daysUntilClaim === 1 ? '' : 's'} left).`}
          </p>
        )}
      </div>
      <RoundsSummary
        rounds={rounds}
        myPlays={myPlays}
        theirPlays={theirPlays}
        opponentName={opponentName}
      />
    </div>
  )
}

function RoundsSummary({ rounds, myPlays, theirPlays, opponentName }) {
  if (rounds.length <= 1) return null
  return (
    <div className="card p-4">
      <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 mb-2">
        Rounds
      </h3>
      <ul className="space-y-1.5">
        {rounds.map((round) => {
          const mine = myPlays.find((p) => p.round_index === round.round_index)
          const theirs = theirPlays.find((p) => p.round_index === round.round_index)
          const resolved = mine && theirs
          return (
            <li
              key={round.round_index}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-wordy-50 dark:bg-[#221540]"
            >
              <span className="text-xs font-bold text-wordy-700 dark:text-wordy-200">
                Round {round.round_index + 1}
              </span>
              <span className="text-xs text-wordy-600 dark:text-wordy-300">
                {resolved
                  ? `You ${mine.score} · ${opponentName} ${theirs.score}`
                  : mine
                    ? `You ${mine.score} · waiting on ${opponentName}`
                    : 'Locked'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CompletedPanel({ user, match, rounds, myPlays, theirPlays, opponentName, onRematch, onBack }) {
  const closedByAdmin = !!match.closed_by_admin
  const youWon = !closedByAdmin && match.winner_id === user.id
  const tied = !closedByAdmin && !match.winner_id

  const myTotal = myPlays.reduce((s, p) => s + p.score, 0)
  const theirTotal = theirPlays.reduce((s, p) => s + p.score, 0)

  const [rematching, setRematching] = useState(false)
  async function handleRematch() {
    if (rematching) return
    setRematching(true)
    try {
      const newMatch = await createMatch({ userId: user.id })
      toast.success('New match posted — your opponent can rejoin.')
      onRematch(newMatch.id)
    } catch (err) {
      console.error('[rematch] failed', err)
      toast.error(err.message || 'Failed to start rematch')
    } finally {
      setRematching(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 text-center">
        <p className="text-5xl mb-2">{closedByAdmin ? '🛑' : youWon ? '🏆' : tied ? '🤝' : '🌙'}</p>
        <p className="font-display text-2xl text-wordy-800 dark:text-wordy-100">
          {closedByAdmin
            ? 'Game closed by admin'
            : youWon ? 'You won!'
            : tied ? 'A tie!'
            : `${opponentName} won.`}
        </p>
        <p className="mt-2 text-sm text-wordy-600 dark:text-wordy-300">
          Total: <span className="font-bold">{myTotal}</span> · {opponentName} <span className="font-bold">{theirTotal}</span>
        </p>
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={handleRematch}
            disabled={rematching}
            className="btn-primary text-sm font-display disabled:opacity-50"
          >
            {rematching ? 'Posting…' : '↻ Rematch'}
          </button>
          <button onClick={onBack} className="btn-secondary text-sm font-display">
            Back to lobby
          </button>
        </div>
      </div>

      {rounds.length > 1 && (
        <div className="card p-4">
          <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 mb-3">
            Round-by-round
          </h3>
          <ul className="space-y-1.5">
            {rounds.map((round) => {
              const mine = myPlays.find((p) => p.round_index === round.round_index)
              const theirs = theirPlays.find((p) => p.round_index === round.round_index)
              const mineWon = mine && theirs && mine.score > theirs.score
              const tiedRound = mine && theirs && mine.score === theirs.score
              return (
                <li
                  key={round.round_index}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-wordy-50 dark:bg-[#221540]"
                >
                  <span className="text-xs font-bold text-wordy-700 dark:text-wordy-200">
                    Round {round.round_index + 1}
                  </span>
                  <span className={`text-xs ${mineWon ? 'text-pink-700 dark:text-pink-300 font-bold' : 'text-wordy-600 dark:text-wordy-300'}`}>
                    You {mine?.score ?? 0} · {opponentName} {theirs?.score ?? 0}
                    {mineWon && ' ★'}
                    {tiedRound && ' ='}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {rounds.map((round) => {
        const mine = myPlays.find((p) => p.round_index === round.round_index)
        const theirs = theirPlays.find((p) => p.round_index === round.round_index)
        const myWords = [...(mine?.words_fed ?? [])].sort((a, b) => a.localeCompare(b))
        const theirWords = [...(theirs?.words_fed ?? [])].sort((a, b) => a.localeCompare(b))
        const myWordSet = new Set(myWords)
        const theirWordSet = new Set(theirWords)
        return (
          <div key={round.round_index} className="space-y-3">
            {rounds.length > 1 && (
              <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 px-1">
                Round {round.round_index + 1} words
              </h3>
            )}
            <WordListPanel title="Your words" words={myWords} highlightSet={theirWordSet} highlightLabel="they got too" />
            <WordListPanel title={`${opponentName}'s words`} words={theirWords} highlightSet={myWordSet} highlightLabel="you got too" />
          </div>
        )
      })}
    </div>
  )
}

function WordListPanel({ title, words, highlightSet, highlightLabel }) {
  if (!words.length) return null
  return (
    <div className="card p-4">
      <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 mb-2">{title}</h3>
      <p className="text-[11px] text-wordy-500 mb-2">Highlighted = {highlightLabel}.</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w) => {
          const shared = highlightSet?.has(w)
          return (
            <span
              key={w}
              className={`px-2 py-0.5 rounded-md text-xs font-display border ${
                shared
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-white text-wordy-800 border-wordy-200 dark:bg-[#2d1b55] dark:text-wordy-100 dark:border-[#3d2070]'
              }`}
            >
              {w.toUpperCase()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ───────── Round play UI ─────────

function RoundPlayPanel({ user, match, round, opponentName, myName, totalRounds, completedRounds, onSubmitted }) {
  const matcher = useMemo(() => matcherFromBaseIds(round.base_rule_ids), [round.base_rule_ids])
  const draftKey = `snibble:match:${match.id}:r${round.round_index}:u${user.id}:words`
  const [built, setBuilt] = useState([])
  const [trayLetters, setTrayLetters] = useState(() => [...round.letters])
  const [wordsFed, setWordsFed] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmingDone, setConfirmingDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const confirmTimerRef = useRef(null)

  // Hydrate from localStorage on mount AND when round changes (best-of-3
  // advances) — survives tab close, navigating to lobby, etc. The draft
  // is cleared on successful submit.
  useEffect(() => {
    let saved = []
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) saved = JSON.parse(raw)
    } catch {}
    setBuilt([])
    setTrayLetters([...round.letters])
    setWordsFed(Array.isArray(saved) ? saved : [])
  }, [draftKey])

  // Persist wordsFed to localStorage on every change.
  useEffect(() => {
    try {
      if (wordsFed.length > 0) localStorage.setItem(draftKey, JSON.stringify(wordsFed))
      else localStorage.removeItem(draftKey)
    } catch {}
  }, [draftKey, wordsFed])

  const fedCount = wordsFed.length
  const score = wordsFed.reduce((s, w) => s + scoreWord(w), 0)
  const percent = round.total_solutions
    ? Math.min(100, (fedCount / round.total_solutions) * 100)
    : 0

  function handleShuffle() {
    const shuffled = [...trayLetters]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setTrayLetters(shuffled)
  }

  async function handleFeed() {
    if (busy) return
    const word = built.join('')
    if (word.length < 4) {
      toast('Words must be 4+ letters')
      return
    }
    setBusy(true)
    try {
      if (wordsFed.includes(word)) {
        toast(`Already submitted "${word}"`)
        return
      }
      if (!(await isValidWord(word))) {
        toast.error(`"${word}" isn't a word`)
        return
      }
      if (!matcher.matches(word)) {
        toast(`Doesn't match: ${matcher.label}`)
        return
      }
      setWordsFed((prev) => [...prev, word])
      toast.success(`+${word}  +${scoreWord(word)} 💜`)
      setBuilt([])
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    if (submitting) return
    if (fedCount === 0) {
      toast(`Submit at least one word — even a small one.`)
      return
    }
    if (!confirmingDone) {
      setConfirmingDone(true)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = window.setTimeout(() => setConfirmingDone(false), 3000)
      return
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmingDone(false)
    setSubmitting(true)
    try {
      const result = await submitMatchRound({
        matchId: match.id,
        roundIndex: round.round_index,
        wordsFed,
      })
      if (result.complete) {
        toast.success('Match complete — opening results.')
      } else if (round.round_index + 1 < totalRounds) {
        toast.success(`Round ${round.round_index + 1} locked in. Next round ready.`)
      } else {
        toast.success('Locked in. Waiting on your opponent.')
      }
      try { localStorage.removeItem(draftKey) } catch {}
      onSubmitted()
    } catch (err) {
      console.error('[submitMatchRound] failed', err)
      toast.error(err.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="mb-2 text-center">
        <p className="text-xs text-wordy-500 font-bold uppercase tracking-wide">
          {myName} vs. {opponentName} {totalRounds > 1 && `· Round ${round.round_index + 1} of ${totalRounds}`}
        </p>
      </div>

      {/* Resolved earlier rounds (in best-of-3) appear above the current craving. */}
      {completedRounds.length > 0 && (
        <div className="card p-3 mb-3">
          <ul className="space-y-1">
            {completedRounds.map((r) => (
              <li key={r.roundIndex} className="flex items-center justify-between text-xs">
                <span className="text-wordy-600 dark:text-wordy-300">Round {r.roundIndex + 1}</span>
                <span className={r.mineWon ? 'text-pink-700 dark:text-pink-300 font-bold' : 'text-wordy-600 dark:text-wordy-300'}>
                  You {r.mine.score} · {opponentName} {r.theirs.score}
                  {r.mineWon && ' ★'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 border border-amber-500 rounded-2xl px-4 py-2 text-center shadow-tile">
        <p className="font-display text-base leading-tight">
          Find words that {matcher.label}
        </p>
      </div>

      {/* Progress / score readout */}
      <div className="bg-white/70 border-2 border-wordy-300 rounded-2xl p-3 mb-2">
        <div className="flex items-center justify-between mb-2 text-xs text-wordy-600">
          <span className="font-bold">{fedCount} of {round.total_solutions} fed</span>
          <span>{score} pts</span>
        </div>
        <div className="h-2 rounded-full bg-wordy-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-400 to-wordy-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Word being built */}
      <BuiltWordRow built={built} setBuilt={setBuilt} placeholder="Build a word…" />

      {/* Letter tray */}
      <div className="bg-white/70 border-2 border-wordy-300 rounded-2xl p-3 mb-2">
        <p className="text-[11px] tracking-widest font-bold text-wordy-700 mb-2 text-center">
          LETTERS — TAP TO REUSE ANY
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {trayLetters.map((letter, i) => (
            <button
              key={i}
              onClick={() => setBuilt((b) => [...b, letter])}
              className="tile font-display text-lg w-10 h-11"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons: Feed, Clear, Shuffle, Submit */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          onClick={handleFeed}
          disabled={busy || built.length < 4}
          className="btn-primary text-sm font-display disabled:opacity-50"
        >
          Feed 🍃
        </button>
        <button
          onClick={() => setBuilt([])}
          disabled={built.length === 0}
          className="btn-secondary text-sm font-display disabled:opacity-50"
        >
          Clear
        </button>
        <button onClick={handleShuffle} className="btn-secondary text-sm font-display">
          Shuffle
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-secondary text-sm font-display"
        >
          {confirmingDone ? 'Sure?' : 'Submit'}
        </button>
      </div>

      {wordsFed.length > 0 && (
        <div className="mt-3 card p-3">
          <p className="text-[11px] uppercase tracking-wide text-wordy-500 mb-2">
            {wordsFed.length} word{wordsFed.length === 1 ? '' : 's'} ready
          </p>
          <div className="flex flex-wrap gap-1.5">
            {wordsFed.map((w) => (
              <span
                key={w}
                className="px-2 py-0.5 rounded-md text-xs font-display bg-wordy-100 text-wordy-800 border border-wordy-200"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
