// ────────────────────────────────────────────────────────────
//  GameView — the actual Snibble daily play loop.
//
//  Renders:
//    - Shared header (matches Wordy / SQ aesthetic)
//    - Pet habitat with the pet at correct stage + chomp reaction
//    - Today's craving banner (current phase)
//    - Phase-progression dots
//    - Word builder (full-width, wraps for long words)
//    - Feed button (full-width below — never gets pushed off mobile)
//    - Letter tray
//    - Words-fed-today summary
//    - "Done for today" wrap-up button (so players can end early
//      when they can't think of more words)
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { generateTodaysPuzzle, scoreWord } from '../lib/cravingGenerator.js'
import { isValidWord } from '../lib/dictionary.js'
import { RULES_BY_ID, lengthMinModifier, PHASE3_BONUSES } from '../lib/rules.js'
import { useActivePet } from '../hooks/useActivePet.js'
import { useDailyState } from '../hooks/useDailyState.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import Mossy from './pets/Mossy.jsx'
import Pip from './pets/Pip.jsx'
import Mochi from './pets/Mochi.jsx'

const PET_COMPONENTS = { mossy: Mossy, pip: Pip, mochi: Mochi }

export default function GameView({ user }) {
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
    generateTodaysPuzzle()
      .then((p) => active && setPuzzle(p))
      .catch((err) => active && setPuzzleErr(err.message || 'Failed to generate puzzle'))
    return () => { active = false }
  }, [])

  if (petLoading || !puzzle) return <ShellWithHeader user={user}><Loading err={puzzleErr} /></ShellWithHeader>
  if (!petInfo) return <ShellWithHeader user={user}><Loading err="No pet — something went wrong." /></ShellWithHeader>

  return (
    <ShellWithHeader user={user}>
      <GameLoop
        puzzle={puzzle}
        petInfo={petInfo}
        dailyState={dailyState}
        onFeed={recordFeed}
        onMarkComplete={markComplete}
      />
    </ShellWithHeader>
  )
}

function ShellWithHeader({ user, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wordy-50 via-pink-50 to-wordy-100">
      <SnibbleHeader user={user} />
      <main className="max-w-[480px] mx-auto px-4 py-4 pb-12">{children}</main>
    </div>
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

function GameLoop({ puzzle, petInfo, dailyState, onFeed, onMarkComplete }) {
  const [built, setBuilt] = useState([])
  const [busy, setBusy] = useState(false)
  const [chomping, setChomping] = useState(false) // controls pet reaction animation

  const phaseRules = useMemo(() => buildPhaseRules(puzzle), [puzzle])
  const phaseCounts = useMemo(() => {
    const counts = [0, 0, 0]
    for (const w of dailyState.wordsFed) {
      const p = w.phase ?? highestMatchingPhase(w.word, phaseRules)
      if (p >= 1 && p <= 3) counts[p - 1]++
    }
    return counts
  }, [dailyState.wordsFed, phaseRules])

  const activePhase = phaseCounts.findIndex((c) => c < 3) // 0/1/2 or -1
  const isComplete = dailyState.isComplete || activePhase === -1
  const PetComponent = PET_COMPONENTS[petInfo.petId] ?? Mossy

  async function handleFeed() {
    if (busy || isComplete) return
    const word = built.join('')
    if (word.length < 3) return
    setBusy(true)
    try {
      if (!(await isValidWord(word))) {
        toast.error(`"${word}" isn't a word`)
        return
      }
      if (dailyState.wordsFed.some((w) => w.word === word)) {
        toast(`Already fed her ${word}`)
        return
      }
      const matchedPhase = highestMatchingPhase(word, phaseRules)
      if (matchedPhase < activePhase + 1) {
        const cravingHint = phaseRules[activePhase].label
        toast(`${petInfo.name} turns away — wants ${cravingHint}`)
        return
      }
      const wordScore = scoreWord(word)
      const willComplete = predictCompletion(phaseCounts, matchedPhase)
      // Trigger the chomp animation BEFORE the await so it overlaps with persistence.
      setChomping(true)
      window.setTimeout(() => setChomping(false), 600)
      await onFeed({ word, wordScore, matchedPhase, willComplete })
      toast.success(`+${word}  +${wordScore} 💜`)
      setBuilt([])
    } finally {
      setBusy(false)
    }
  }

  async function handleDoneForToday() {
    if (dailyState.wordsFed.length === 0) {
      // Encourage at least one feed — but don't block, let them just leave if they want.
      toast(`Try at least one word first — anything counts.`)
      return
    }
    await onMarkComplete()
    toast.success(`${petInfo.name} is full 🌙`)
  }

  const fedCount = dailyState.wordsFed.length

  return (
    <>
      {/* Inline back-to-lobby */}
      <div className="mb-2">
        <button
          onClick={() => {
            window.history.pushState({}, '', window.location.pathname)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          className="text-sm font-bold text-wordy-400 hover:text-wordy-700 transition-colors"
        >
          ← Lobby
        </button>
      </div>

      {/* Pet habitat */}
      <div className="bg-gradient-to-b from-pink-100 to-wordy-200 rounded-3xl border-2 border-wordy-700 p-4 shadow-tile">
        <div className={`mx-auto max-w-[240px] ${chomping ? 'snibble-chomp' : ''}`}>
          <PetComponent
            stage={petInfo.stage}
            mouth={chomping || busy ? 'open' : 'smile'}
            className="w-full h-auto snibble-pet"
          />
        </div>

        <div className="flex items-center justify-center gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <PhaseDot key={i} count={phaseCounts[i]} active={i === activePhase} />
          ))}
        </div>

        <p className="text-center text-xs text-wordy-700 mt-2">
          <span className="font-display">{petInfo.name}</span> · {petInfo.stage} · fed{' '}
          {petInfo.growth} of {petInfo.growthRequired} days
        </p>
      </div>

      {/* If complete, show wrap-up. Otherwise show the play loop. */}
      {isComplete ? (
        <CompleteCard
          petName={petInfo.name}
          score={dailyState.score}
          wordsFed={dailyState.wordsFed.map((w) => w.word)}
        />
      ) : (
        <>
          {/* Today's craving banner */}
          <div className="mt-4 mb-3 bg-gradient-to-br from-amber-200 to-amber-400 text-amber-900 border border-amber-500 rounded-2xl px-4 py-3 text-center shadow-tile">
            <p className="text-[10px] tracking-widest font-bold opacity-80">
              {petInfo.name.toUpperCase()}'S CRAVING · PHASE {activePhase + 1} OF 3
            </p>
            <p className="font-display text-base mt-1 leading-tight">
              {phaseRules[activePhase].label}
            </p>
          </div>

          {/* Word being built — full-width, wraps gracefully for long words */}
          <div className="bg-white/70 border-2 border-dashed border-wordy-400 rounded-2xl px-3 py-3 min-h-[64px] flex flex-wrap items-center justify-center gap-1.5 mb-2">
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
                  className="w-9 h-10 grid place-items-center bg-gradient-to-br from-yellow-200 to-yellow-400 text-yellow-900 font-display text-lg rounded-lg border border-yellow-600 shadow-tile"
                >
                  {letter}
                </button>
              ))
            )}
          </div>

          {/* Feed button — full-width on its own row so it never gets pushed off */}
          <button
            disabled={built.length < 3 || busy}
            onClick={handleFeed}
            className="w-full py-3 font-display text-lg rounded-2xl text-white bg-gradient-to-br from-wordy-400 to-wordy-600 shadow-tile disabled:opacity-50 transition-transform active:translate-y-0.5"
          >
            Feed 🍃
          </button>
          <div className="text-center mt-1 mb-3">
            {built.length > 0 && (
              <button onClick={() => setBuilt([])} className="text-xs text-wordy-700 underline">clear</button>
            )}
          </div>

          {/* Letter tray */}
          <div className="bg-white/70 border-2 border-wordy-300 rounded-2xl p-3 mb-3">
            <p className="text-[11px] tracking-widest font-bold text-wordy-700 mb-2">
              TODAY'S LETTERS — TAP TO REUSE ANY
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {puzzle.letters.map((letter, i) => (
                <button
                  key={i}
                  onClick={() => setBuilt((b) => [...b, letter])}
                  className="w-10 h-11 grid place-items-center bg-gradient-to-br from-wordy-200 to-wordy-400 text-wordy-900 font-display text-lg rounded-lg border border-wordy-600 shadow-tile transition-transform active:translate-y-0.5"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          {/* Done for today — appears once they've fed at least one word */}
          {fedCount > 0 && (
            <button
              onClick={handleDoneForToday}
              className="w-full py-2.5 text-sm text-wordy-700 bg-white/60 border border-wordy-200 rounded-2xl hover:bg-white transition-colors"
            >
              Done for today 🌙
            </button>
          )}
        </>
      )}

      {/* Fed-today list — visible during play AND in wrap-up */}
      {fedCount > 0 && (
        <div className="mt-4 bg-white/70 border border-wordy-200 rounded-xl p-3">
          <p className="text-[11px] tracking-widest font-bold text-wordy-700 mb-1.5">
            FED TODAY · {fedCount} {fedCount === 1 ? 'WORD' : 'WORDS'} · {dailyState.score} PTS
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dailyState.wordsFed.map((w, i) => (
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

// ───────── Helpers ─────────

function buildPhaseRules(puzzle) {
  const base = RULES_BY_ID[puzzle.base.id]
  if (!base) return [{ label: puzzle.base.label, rules: [] }]
  const out = [{ label: base.label, rules: [base] }]

  const p2 = parsePhaseLabel(puzzle.phases[1].label)
  if (p2) {
    out.push({ label: puzzle.phases[1].label, rules: [base, lengthMinModifier(p2.lenMin)] })
  } else {
    out.push({ label: puzzle.phases[1].label, rules: [base] })
  }

  const p3 = parsePhaseLabel(puzzle.phases[2].label)
  if (p3) {
    const lenMod = lengthMinModifier(p3.lenMin)
    const bonusRule = PHASE3_BONUSES.find((b) => b.label === p3.bonusLabel)
    out.push({
      label: puzzle.phases[2].label,
      rules: bonusRule ? [base, lenMod, bonusRule] : [base, lenMod],
    })
  } else {
    out.push({ label: puzzle.phases[2].label, rules: [base] })
  }
  return out
}

function parsePhaseLabel(label) {
  const parts = label.split(' · ')
  if (parts.length < 2) return null
  const lenMatch = parts[1].match(/(\d+)\+ letters/)
  if (!lenMatch) return null
  return { lenMin: parseInt(lenMatch[1], 10), bonusLabel: parts[2] || null }
}

function highestMatchingPhase(word, phaseRules) {
  const w = word.toUpperCase()
  for (let i = 2; i >= 0; i--) {
    if (phaseRules[i].rules.every((r) => r.matches(w))) return i + 1
  }
  return 0
}

function predictCompletion(phaseCounts, matchedPhase) {
  const next = phaseCounts.slice()
  if (matchedPhase >= 1) next[matchedPhase - 1]++
  return next.every((c) => c >= 3)
}

function PhaseDot({ count, active }) {
  const filled = count >= 3
  const ring = active ? 'ring-2 ring-wordy-500' : ''
  return (
    <div
      className={`relative w-14 h-2.5 rounded-full ${filled ? 'bg-wordy-600' : 'bg-wordy-200'} ${ring}`}
      title={`Phase: ${count} / 3`}
    >
      {!filled && count > 0 && (
        <div
          className="absolute inset-y-0 left-0 bg-wordy-400 rounded-full"
          style={{ width: `${(count / 3) * 100}%` }}
        />
      )}
    </div>
  )
}

function CompleteCard({ petName, score, wordsFed }) {
  return (
    <div className="card p-5 text-center mt-4">
      <p className="font-display text-2xl text-wordy-800 mb-1">{petName} is full 🌙</p>
      <p className="text-sm text-wordy-700">See you tomorrow.</p>
      <p className="text-sm text-wordy-700 mt-3">
        Today's score: <strong>{score}</strong>
      </p>
      <p className="text-xs text-wordy-500 italic mt-1">
        {wordsFed.length} word{wordsFed.length === 1 ? '' : 's'} fed
      </p>
    </div>
  )
}
