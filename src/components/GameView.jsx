// ────────────────────────────────────────────────────────────
//  GameView — Snibble's daily play loop (v2: phaseless).
//
//  One craving per day. Player feeds qualifying words. Progress bar
//  fills toward total findable solutions. A "par" tick mark sits at
//  the threshold an average player can reach with effort (the count
//  of solutions that are also in the common-words list).
//
//  States the player can reach:
//    - Under par: "Mossy is hungry"
//    - At/above par: small celebration toast
//    - 100%: rare cozy victory — "Mossy is FULL — you got them all!"
//    - Any time: "Done for today" wraps up at whatever they've found
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { scoreWord } from '../lib/cravingGenerator.js'
import { loadDailyPuzzle } from '../lib/dailyPuzzle.js'
import { isCommonWord } from '../lib/dictionary.js'
import { RULES_BY_ID } from '../lib/rules.js'
import { useActivePet } from '../hooks/useActivePet.js'
import { useDailyState } from '../hooks/useDailyState.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import { PET_COMPONENTS } from '../lib/pets.jsx'
import { SQBoardShell, SQBoardHeader } from '../../../rae-side-quest/packages/sq-ui/index.js'
const MILESTONE_MARKS = [5, 10, 25, 50] // word-count milestones for toasts

export default function GameView({ user, onBack }) {
  const [puzzle, setPuzzle] = useState(null)
  const [puzzleErr, setPuzzleErr] = useState(null)
  const { petInfo, loading: petLoading, tickGrowth } = useActivePet(user.id)
  const { state: dailyState, recordFeed, onFirstFeed, markComplete } = useDailyState({
    userId: user.id,
    petId: petInfo?.petId,
  })

  useEffect(() => {
    onFirstFeed(async () => { await tickGrowth() })
  }, [onFirstFeed, tickGrowth])

  useEffect(() => {
    let active = true
    loadDailyPuzzle()
      .then((p) => active && setPuzzle(p))
      .catch((err) => active && setPuzzleErr(err.message || 'Failed to generate puzzle'))
    return () => { active = false }
  }, [])

  if (petLoading || !puzzle) return <ShellWithHeader user={user} onBack={onBack}><Loading err={puzzleErr} /></ShellWithHeader>
  if (!petInfo) return <ShellWithHeader user={user} onBack={onBack}><Loading err="No pet — something went wrong." /></ShellWithHeader>

  return (
    <ShellWithHeader user={user} onBack={onBack}>
      <GameLoop
        user={user}
        puzzle={puzzle}
        petInfo={petInfo}
        dailyState={dailyState}
        onFeed={recordFeed}
        onMarkComplete={markComplete}
        onBack={onBack}
      />
    </ShellWithHeader>
  )
}

function ShellWithHeader({ user, onBack, children }) {
  return (
    <SQBoardShell
      width="narrow"
      header={<SnibbleHeader user={user} />}
      subHeader={
        <SQBoardHeader backLabel="← Lobby" onBackClick={onBack} />
      }
    >
      {children}
    </SQBoardShell>
  )
}

function Loading({ err }) {
  return (
    <div className="text-center py-16">
      {err
        ? <p className="text-wordy-700">Couldn't load Snibble — {err}</p>
        : <p className="text-wordy-600 italic">Loading today's puzzle…</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────

function GameLoop({ user, puzzle, petInfo, dailyState, onFeed, onMarkComplete, onBack }) {
  const [built, setBuilt] = useState([])
  const [busy, setBusy] = useState(false)
  const [chomping, setChomping] = useState(false)
  const [confirmingDone, setConfirmingDone] = useState(false)
  const [trayLetters, setTrayLetters] = useState(() => [...puzzle.letters])
  const confirmTimerRef = useRef(null)
  const milestonesRef = useRef(new Set())
  const parToastShownRef = useRef(false)

  function handleShuffle() {
    const shuffled = [...trayLetters]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setTrayLetters(shuffled)
  }

  const baseRule = useMemo(() => RULES_BY_ID[puzzle.base.id], [puzzle.base.id])

  const wordsFed = dailyState.wordsFed
  const fedCount = wordsFed.length
  const score = dailyState.score
  const isComplete = dailyState.isComplete || fedCount >= puzzle.totalSolutions

  // Milestone + par-crossing toasts. Tracked via refs so they fire once.
  useEffect(() => {
    if (!fedCount) return
    for (const mark of MILESTONE_MARKS) {
      if (fedCount === mark && !milestonesRef.current.has(mark)) {
        milestonesRef.current.add(mark)
        toast(`✨ ${mark} words fed!`)
      }
    }
    if (
      fedCount >= puzzle.parCount &&
      puzzle.parCount > 0 &&
      !parToastShownRef.current &&
      fedCount < puzzle.totalSolutions
    ) {
      parToastShownRef.current = true
      toast.success(`You fed ${petInfo.name} well today 🌸`)
    }
  }, [fedCount, puzzle.parCount, puzzle.totalSolutions, petInfo.name])

  async function handleFeed() {
    if (busy || isComplete) return
    const word = built.join('')
    if (word.length < 4) return
    setBusy(true)
    try {
      if (wordsFed.some((w) => w.word === word)) {
        toast(`${petInfo.name} already ate that!`)
        return
      }
      if (!(await isCommonWord(word))) {
        toast.error(`"${word}" isn't a word`)
        return
      }
      if (!baseRule.matches(word)) {
        toast(`${petInfo.name} turns away — wants ${puzzle.base.craving ?? puzzle.base.label}`)
        return
      }
      const wordScore = scoreWord(word)
      const willComplete = fedCount + 1 >= puzzle.totalSolutions

      setChomping(true)
      window.setTimeout(() => setChomping(false), 600)
      await onFeed({ word, wordScore, willComplete })
      toast.success(`+${word}  +${wordScore} 💜`)
      setBuilt([])

      if (willComplete) {
        setTimeout(() => {
          toast.success(`🎉 ${petInfo.name} is FULL — you got them all!`, { duration: 4000 })
        }, 350)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDoneForToday() {
    if (fedCount === 0) {
      toast(`Try at least one word first — anything counts.`)
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
    await onMarkComplete()
    toast.success(`${petInfo.name} is full enough 🌙`)
    // Navigate to the full StatsPage (route-based, matching Yahdle/Rungles).
    const newUrl = `${window.location.pathname}?view=stats${window.location.hash}`
    window.history.pushState({}, '', newUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const PetComponent = PET_COMPONENTS[petInfo.petId] ?? PET_COMPONENTS.mossy

  return (
    <>
      {isComplete ? (
        <>
          {/* Pet habitat (compact) */}
          <div className="bg-gradient-to-b from-pink-100 to-wordy-200 rounded-3xl border-2 border-wordy-700 p-3 shadow-tile">
            <div className={`mx-auto max-w-[140px] ${chomping ? 'snibble-chomp' : ''}`}>
              <PetComponent
                stage={petInfo.stage}
                mouth={chomping || busy ? 'open' : 'smile'}
                className="w-full h-auto snibble-pet"
              />
            </div>
            <FullnessBar
              fed={fedCount}
              total={puzzle.totalSolutions}
              par={puzzle.parCount}
            />
          </div>

          <CompleteCard
            petName={petInfo.name}
            score={score}
            fedCount={fedCount}
            totalSolutions={puzzle.totalSolutions}
            parCount={puzzle.parCount}
          />
        </>
      ) : (
        <>
          {/* Today's craving — single line above the pet */}
          <div className="mb-3 bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 border border-amber-500 rounded-2xl px-4 py-2 text-center shadow-tile">
            <p className="font-display text-base leading-tight">
              {petInfo.name} is hungry for {puzzle.base.craving ?? `words that ${puzzle.base.label}`}
            </p>
          </div>

          {/* Pet habitat (compact) */}
          <div className="bg-gradient-to-b from-pink-100 to-wordy-200 rounded-3xl border-2 border-wordy-700 p-3 shadow-tile">
            <div className={`mx-auto max-w-[140px] ${chomping ? 'snibble-chomp' : ''}`}>
              <PetComponent
                stage={petInfo.stage}
                mouth={chomping || busy ? 'open' : 'smile'}
                className="w-full h-auto snibble-pet"
              />
            </div>
            <FullnessBar
              fed={fedCount}
              total={puzzle.totalSolutions}
              par={puzzle.parCount}
            />
          </div>

          {/* Word being built */}
          <div className="mt-3 bg-white/70 border-2 border-dashed border-wordy-400 rounded-2xl px-3 py-3 min-h-[64px] flex flex-wrap items-center justify-center gap-1.5 mb-2">
            {built.length === 0 ? (
              <span className="italic text-wordy-500 text-sm">
                Build a word for {petInfo.name}…
              </span>
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
              TODAY'S LETTERS — TAP TO REUSE ANY
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

          {/* Action buttons under the rack: Feed, Clear, Shuffle, Done */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              disabled={built.length < 4 || busy}
              onClick={handleFeed}
              className="btn-primary py-2.5 font-display text-sm disabled:opacity-50"
            >
              Feed 🍃
            </button>
            <button
              disabled={built.length === 0 || busy}
              onClick={() => setBuilt([])}
              className="btn-secondary py-2.5 font-display text-sm disabled:opacity-50"
            >
              Clear
            </button>
            <button
              disabled={busy}
              onClick={handleShuffle}
              className="btn-secondary py-2.5 font-display text-sm disabled:opacity-50"
            >
              Shuffle
            </button>
            <button
              disabled={fedCount === 0 || busy}
              onClick={handleDoneForToday}
              className="btn-secondary py-2.5 font-display text-sm disabled:opacity-50 leading-tight"
            >
              {confirmingDone ? 'Sure?' : 'Done 🌙'}
            </button>
          </div>
        </>
      )}

      {fedCount > 0 && (
        <div className="mt-4 bg-white/70 border border-wordy-200 rounded-xl p-3">
          <p className="text-[11px] tracking-widest font-bold text-wordy-700 mb-1.5">
            FED TODAY · {fedCount} {fedCount === 1 ? 'WORD' : 'WORDS'} · {score} PTS
          </p>
          <div className="flex flex-wrap gap-1.5">
            {wordsFed.map((w, i) => (
              <span
                key={i}
                className="bg-wordy-100 text-wordy-800 text-xs font-display px-2.5 py-0.5 rounded-full border border-wordy-300"
              >
                {w.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ───────── Sub-components ─────────

function FullnessBar({ fed, total, par }) {
  const pct = total > 0 ? Math.min(100, (fed / total) * 100) : 0
  const parPct = total > 0 && par > 0 ? Math.min(99, (par / total) * 100) : null
  const atOrPastPar = par > 0 && fed >= par

  return (
    <div className="mt-3 px-1">
      <div className="relative h-3.5 bg-wordy-100 border border-wordy-300 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-300 to-wordy-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {parPct !== null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-amber-700/80"
            style={{ left: `${parPct}%` }}
            title={`Par: ${par} words`}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-wordy-700">
          {fed} of {total} words {atOrPastPar && <span className="text-amber-700">· past par 🌸</span>}
        </span>
        {parPct !== null && (
          <span className="text-[10px] text-wordy-500">par: {par}</span>
        )}
      </div>
    </div>
  )
}

function CompleteCard({ petName, score, fedCount, totalSolutions, parCount }) {
  const gotThemAll = fedCount >= totalSolutions
  const pastPar = parCount > 0 && fedCount >= parCount
  return (
    <div className="card p-5 text-center mt-4">
      <p className="font-display text-2xl text-wordy-800 mb-1">
        {gotThemAll
          ? `${petName} is FULL! 🎉`
          : pastPar
            ? `${petName} ate well 🌸`
            : `${petName} is settled 🌙`}
      </p>
      <p className="text-sm text-wordy-700">See you tomorrow.</p>
      <p className="text-sm text-wordy-700 mt-3">
        Score: <strong>{score}</strong>  ·  {fedCount} of {totalSolutions} words
      </p>
      {gotThemAll && (
        <p className="text-xs text-amber-700 italic mt-2">
          You found every word in the dictionary today.
        </p>
      )}
    </div>
  )
}
