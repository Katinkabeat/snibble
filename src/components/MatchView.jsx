// ────────────────────────────────────────────────────────────
//  MatchView — single-round async head-to-head match screen.
//
//  State branches:
//    open            : waiting for opponent (cancel + share later)
//    in_progress, you owe a play  → round-play UI
//    in_progress, you submitted   → waiting on them
//    completed        : final scoreboard with both word lists
//
//  Best-of-3 will be added in chunk 2; this view handles round 0
//  only for now.
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { isCommonWord } from '../lib/dictionary.js'
import { matcherFromBaseIds, submitMatchRound } from '../lib/matchActions.js'
import { scoreWord } from '../lib/cravingGenerator.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import { SQBoardShell, SQBoardHeader } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function MatchView({ user, matchId, onBack }) {
  const [match, setMatch] = useState(null)
  const [round, setRound] = useState(null)
  const [myPlay, setMyPlay] = useState(null)        // your submitted play (if any)
  const [theirPlay, setTheirPlay] = useState(null)   // opponent's play (visible after both submit)
  const [opponent, setOpponent] = useState(null)
  const [creator, setCreator] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data: m, error: mErr } = await supabase
          .from('sn_matches')
          .select('*')
          .eq('id', matchId)
          .single()
        if (mErr) throw mErr

        const { data: rounds, error: rErr } = await supabase
          .from('sn_match_rounds')
          .select('*')
          .eq('match_id', matchId)
          .order('round_index', { ascending: true })
        if (rErr) throw rErr

        const { data: plays, error: pErr } = await supabase
          .from('sn_match_round_plays')
          .select('*')
          .eq('match_id', matchId)
          .eq('round_index', 0)
        if (pErr) throw pErr

        const userIds = [m.creator_id, m.opponent_id].filter(Boolean)
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, avatar_hue')
          .in('id', userIds)
        const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

        if (!active) return
        setMatch(m)
        setRound(rounds?.[0] ?? null)
        setMyPlay((plays ?? []).find((p) => p.user_id === user.id) ?? null)
        setTheirPlay((plays ?? []).find((p) => p.user_id !== user.id) ?? null)
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
  const otherProfile = match
    ? (match.creator_id === user.id ? opponent : creator)
    : null

  return (
    <SQBoardShell
      width="narrow"
      header={<SnibbleHeader user={user} />}
      subHeader={<SQBoardHeader backLabel="← Lobby" onBackClick={onBack} />}
    >
      {loading && <p className="italic text-wordy-500 text-center py-12">Loading match…</p>}
      {error && <p className="text-rose-600 text-sm text-center py-12">{error}</p>}

      {!loading && !error && match && (
        <>
          {match.status === 'open' && (
            <OpenMatchPanel match={match} onBack={onBack} />
          )}

          {match.status === 'in_progress' && !myPlay && round && (
            <RoundPlayPanel
              user={user}
              match={match}
              round={round}
              opponentName={otherProfile?.username ?? 'opponent'}
              onSubmitted={refresh}
            />
          )}

          {match.status === 'in_progress' && myPlay && !theirPlay && (
            <WaitingPanel
              opponentName={otherProfile?.username ?? 'opponent'}
              myPlay={myPlay}
              round={round}
            />
          )}

          {match.status === 'completed' && (
            <CompletedPanel
              user={user}
              match={match}
              round={round}
              myPlay={myPlay}
              theirPlay={theirPlay}
              opponentName={otherProfile?.username ?? 'opponent'}
            />
          )}
        </>
      )}
    </SQBoardShell>
  )
}

// ───────── Panels ─────────

function OpenMatchPanel({ match }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-4xl mb-3">🪧</p>
      <p className="font-display text-lg text-wordy-800 dark:text-wordy-100">
        Match posted
      </p>
      <p className="text-sm text-wordy-600 dark:text-wordy-300 mt-2">
        Waiting for someone to join. They'll appear in their lobby's "open matches" browser.
      </p>
      <p className="text-xs text-wordy-500 mt-3 italic">
        {match.format === 'best_of_3' ? 'Best of 3' : 'Single round'}
      </p>
    </div>
  )
}

function WaitingPanel({ opponentName, myPlay, round }) {
  const percent = round?.total_solutions
    ? Math.round((myPlay.words_fed.length / round.total_solutions) * 100)
    : 0
  return (
    <div className="card p-6 text-center">
      <p className="text-4xl mb-3">⏳</p>
      <p className="font-display text-lg text-wordy-800 dark:text-wordy-100">
        Waiting on {opponentName}
      </p>
      <p className="text-sm text-wordy-600 dark:text-wordy-300 mt-2">
        Your round is locked in.
      </p>
      <div className="mt-4 inline-block px-3 py-1.5 rounded-full bg-wordy-100 text-wordy-700 text-sm font-bold">
        {myPlay.score} pts · {percent}%
      </div>
    </div>
  )
}

function CompletedPanel({ user, match, round, myPlay, theirPlay, opponentName }) {
  const youWon = match.winner_id === user.id
  const tied = !match.winner_id
  const ranked = [
    { label: 'You', play: myPlay, isYou: true },
    { label: opponentName, play: theirPlay, isYou: false },
  ].sort((a, b) => (b.play?.score ?? 0) - (a.play?.score ?? 0))

  const myWords = [...(myPlay?.words_fed ?? [])].sort((a, b) => a.localeCompare(b))
  const theirWords = [...(theirPlay?.words_fed ?? [])].sort((a, b) => a.localeCompare(b))
  const myWordSet = new Set(myWords)
  const theirWordSet = new Set(theirWords)

  return (
    <div className="space-y-4">
      <div className="card p-6 text-center">
        <p className="text-5xl mb-2">{youWon ? '🏆' : tied ? '🤝' : '🌙'}</p>
        <p className="font-display text-2xl text-wordy-800 dark:text-wordy-100">
          {youWon ? 'You won!' : tied ? 'A tie!' : `${opponentName} won.`}
        </p>
      </div>

      <div className="card p-4">
        <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 mb-3">
          Final scores
        </h3>
        <ul className="space-y-1.5">
          {ranked.map(({ label, play, isYou }) => {
            const percent = round?.total_solutions
              ? Math.round(((play?.words_fed?.length ?? 0) / round.total_solutions) * 100)
              : 0
            return (
              <li
                key={label}
                className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                  isYou
                    ? 'bg-gradient-to-r from-wordy-100 to-pink-50 ring-2 ring-wordy-400'
                    : 'bg-wordy-50'
                }`}
              >
                <span className="font-bold text-wordy-800 dark:text-wordy-100">{label}</span>
                <span className="font-display text-wordy-800 dark:text-wordy-100">
                  {play?.score ?? 0} pts <span className="text-wordy-500 font-normal">· {percent}%</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <WordListPanel title="Your words" words={myWords} highlightSet={theirWordSet} highlightLabel="they got too" />
      <WordListPanel title={`${opponentName}'s words`} words={theirWords} highlightSet={myWordSet} highlightLabel="you got too" />
    </div>
  )
}

function WordListPanel({ title, words, highlightSet, highlightLabel }) {
  if (!words.length) return null
  return (
    <div className="card p-4">
      <h3 className="font-display text-sm uppercase tracking-wide text-wordy-500 mb-2">{title}</h3>
      <p className="text-[11px] text-wordy-500 mb-2">
        Highlighted = {highlightLabel}.
      </p>
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

function RoundPlayPanel({ user, match, round, opponentName, onSubmitted }) {
  const matcher = useMemo(() => matcherFromBaseIds(round.base_rule_ids), [round.base_rule_ids])
  const [built, setBuilt] = useState([])
  const [trayLetters, setTrayLetters] = useState(() => [...round.letters])
  const [wordsFed, setWordsFed] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmingDone, setConfirmingDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const confirmTimerRef = useRef(null)

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
    if (word.length < 3) return
    setBusy(true)
    try {
      if (wordsFed.includes(word)) {
        toast(`Already submitted "${word}"`)
        return
      }
      if (!(await isCommonWord(word))) {
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
        userId: user.id,
        wordsFed,
      })
      if (result.complete) {
        toast.success('Match complete — opening results.')
      } else {
        toast.success('Locked in. Waiting on your opponent.')
      }
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
          vs. {opponentName} · Round {round.round_index + 1}
        </p>
      </div>

      <div className="mb-3 bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 border border-amber-500 rounded-2xl px-4 py-2 text-center shadow-tile">
        <p className="font-display text-base leading-tight">
          Find words that {matcher.label}
        </p>
      </div>

      {/* Fullness/progress bar (no pet in match mode) */}
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
      <div className="bg-white/70 border-2 border-dashed border-wordy-400 rounded-2xl px-3 py-3 min-h-[64px] flex flex-wrap items-center justify-center gap-1.5 mb-2">
        {built.length === 0 ? (
          <span className="italic text-wordy-500 text-sm">Build a word…</span>
        ) : (
          built.map((letter, i) => (
            <button
              key={i}
              onClick={() => setBuilt(built.filter((_, j) => j !== i))}
              title="Tap to remove this letter"
              className="tile tile-placed font-display text-lg w-10 h-11"
            >
              {letter}
            </button>
          ))
        )}
      </div>

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
          disabled={busy || built.length < 3}
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
