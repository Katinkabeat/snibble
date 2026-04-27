// ────────────────────────────────────────────────────────────
//  GameView — the actual Snibble game. Replaces the under-construction
//  placeholder once the rest of v1 is wired up.
//
//  Renders the daily loop:
//    - active pet at correct growth stage
//    - today's craving (phase rules)
//    - letter tray (reusable letters)
//    - word builder + Feed button + Clear
//    - fullness bar showing phase progression
//    - words fed today list
//
//  Wires the generator (deterministic daily puzzle) to the user's
//  session state (Supabase sn_daily_feeds + sn_progress via hooks).
// ────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { generateTodaysPuzzle, scoreWord } from '../lib/cravingGenerator.js'
import { isValidWord } from '../lib/dictionary.js'
import { RULES_BY_ID, lengthMinModifier, PHASE3_BONUSES } from '../lib/rules.js'
import { useActivePet } from '../hooks/useActivePet.js'
import { useDailyState } from '../hooks/useDailyState.js'
import Mossy from './pets/Mossy.jsx'
import Pip from './pets/Pip.jsx'
import Mochi from './pets/Mochi.jsx'

const PET_COMPONENTS = { mossy: Mossy, pip: Pip, mochi: Mochi }

export default function GameView({ user }) {
  const [puzzle, setPuzzle] = useState(null)
  const [puzzleErr, setPuzzleErr] = useState(null)
  const { petInfo, loading: petLoading, tickGrowth } = useActivePet(user.id)
  const { state: dailyState, recordFeed, onFirstFeed } = useDailyState({
    userId: user.id,
    petId: petInfo?.petId,
  })

  // Wire growth tick on first feed.
  useEffect(() => {
    onFirstFeed(async () => { await tickGrowth() })
  }, [onFirstFeed, tickGrowth])

  // Load today's puzzle.
  useEffect(() => {
    let active = true
    generateTodaysPuzzle()
      .then((p) => active && setPuzzle(p))
      .catch((err) => active && setPuzzleErr(err.message || 'Failed to generate puzzle'))
    return () => { active = false }
  }, [])

  if (petLoading || !puzzle) return <LoadingShell err={puzzleErr} />
  if (!petInfo) return <LoadingShell err="No pet — something went wrong." />

  return (
    <GameLoop
      user={user}
      puzzle={puzzle}
      petInfo={petInfo}
      dailyState={dailyState}
      onFeed={recordFeed}
    />
  )
}

function LoadingShell({ err }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      {err
        ? <p className="text-wordy-700">Couldn't load Snibble — {err}</p>
        : <p className="text-wordy-600 italic">Loading today's puzzle…</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────

function GameLoop({ user, puzzle, petInfo, dailyState, onFeed }) {
  const [built, setBuilt] = useState([]) // letters being assembled
  const [busy, setBusy] = useState(false)

  // Reconstruct phase-rules so we can validate fed words and decide
  // which phase a word belongs to. The puzzle stores per-phase labels
  // and a base rule id; we rebuild by combining the same way the
  // generator did.
  const phaseRules = useMemo(() => buildPhaseRules(puzzle), [puzzle])

  // Recompute per-phase fed counts from the daily state. If words came
  // from a reload, their `phase` will be null — re-derive on the fly.
  const phaseCounts = useMemo(() => {
    const counts = [0, 0, 0]
    for (const w of dailyState.wordsFed) {
      const p = w.phase ?? highestMatchingPhase(w.word, phaseRules)
      if (p >= 1 && p <= 3) counts[p - 1]++
    }
    return counts
  }, [dailyState.wordsFed, phaseRules])

  // Active phase = lowest phase that's still under 3 feeds. If all 3
  // are done, isComplete kicks in and the game shows the wrap-up state.
  const activePhase = phaseCounts.findIndex((c) => c < 3) // 0/1/2 or -1
  const isComplete = activePhase === -1
  const PetComponent = PET_COMPONENTS[petInfo.petId] ?? Mossy

  async function handleFeed() {
    if (busy || isComplete) return
    const word = built.join('')
    if (word.length < 3) {
      toast(`Words need to be at least 3 letters.`)
      return
    }
    setBusy(true)
    try {
      // 1) Real word?
      const valid = await isValidWord(word)
      if (!valid) {
        toast.error(`"${word}" isn't a word`)
        return
      }
      // 2) Already fed today?
      if (dailyState.wordsFed.some((w) => w.word === word)) {
        toast(`Already fed her ${word}`)
        return
      }
      // 3) Match the active phase rule?
      const matchedPhase = highestMatchingPhase(word, phaseRules)
      if (matchedPhase < activePhase + 1) {
        const cravingHint = phaseRules[activePhase].label
        toast(`${petInfo.name} turns away — wants ${cravingHint}`)
        return
      }

      // 4) Persist!
      const wordScore = scoreWord(word)
      const willComplete = predictCompletion(phaseCounts, matchedPhase)
      await onFeed({ word, wordScore, matchedPhase, willComplete })
      toast.success(`+${word} 💜  (+${wordScore})`)
      setBuilt([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-4 pb-12">
      <div className="max-w-md mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              window.history.pushState({}, '', window.location.pathname)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
            className="text-xs text-wordy-700 hover:underline"
          >
            ← Lobby
          </button>
          <span className="font-display text-sm text-wordy-800">{petInfo.name} · {growthLabel(petInfo)}</span>
          <span /> {/* spacer */}
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl text-wordy-800 text-center mb-1">Snibble</h1>

        {/* Today's craving */}
        <CravingBanner puzzle={puzzle} activePhase={activePhase} isComplete={isComplete} petName={petInfo.name} />

        {/* Pet habitat */}
        <div className="my-3 bg-gradient-to-b from-pink-100 to-wordy-100 rounded-3xl border-2 border-wordy-700 p-4 shadow-tile">
          <PetComponent
            stage={petInfo.stage}
            mouth={busy ? 'open' : 'smile'}
            className="w-full max-w-[220px] mx-auto h-auto snibble-pet"
          />

          {/* Phase progression dots */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {[0, 1, 2].map((i) => (
              <PhaseDot key={i} count={phaseCounts[i]} active={i === activePhase} />
            ))}
          </div>

          {/* Pet growth ribbon */}
          <p className="text-center text-xs text-wordy-700 mt-2 italic">
            {petInfo.name} has been fed {petInfo.growth} of {petInfo.growthRequired} days
          </p>
        </div>

        {/* If the day is complete, show the wrap-up. Otherwise show the play loop. */}
        {isComplete ? (
          <CompleteCard
            petName={petInfo.name}
            score={dailyState.score}
            wordsFed={dailyState.wordsFed.map((w) => w.word)}
          />
        ) : (
          <>
            {/* Word builder + actions */}
            <div className="flex items-stretch gap-2 mb-2">
              <div className="flex-1 min-h-[52px] bg-white/60 border-2 border-dashed border-wordy-400 rounded-2xl flex items-center justify-center gap-1 px-2 py-2">
                {built.length === 0 ? (
                  <span className="italic text-wordy-500 text-sm">Build a word for {petInfo.name}…</span>
                ) : (
                  built.map((letter, i) => (
                    <button
                      key={i}
                      onClick={() => setBuilt(built.filter((_, j) => j !== i))}
                      className="w-9 h-10 grid place-items-center bg-gradient-to-br from-yellow-200 to-yellow-400 text-yellow-900 font-display text-lg rounded-lg border border-yellow-600 shadow-tile"
                    >
                      {letter}
                    </button>
                  ))
                )}
              </div>
              <button
                disabled={built.length < 3 || busy}
                onClick={handleFeed}
                className="px-4 py-3 font-display text-lg rounded-2xl text-white bg-gradient-to-br from-wordy-400 to-wordy-600 shadow-tile disabled:opacity-50"
              >
                Feed 🍃
              </button>
            </div>
            <div className="text-center mb-3">
              <button onClick={() => setBuilt([])} className="text-xs text-wordy-700 underline">clear</button>
            </div>

            {/* Letter tray */}
            <div className="bg-white/60 border-2 border-wordy-300 rounded-2xl p-3">
              <p className="text-[11px] tracking-wide font-bold text-wordy-700 uppercase mb-2">
                today's letters — tap to reuse any
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {puzzle.letters.map((letter, i) => (
                  <button
                    key={i}
                    onClick={() => setBuilt((b) => [...b, letter])}
                    className="w-10 h-11 grid place-items-center bg-gradient-to-br from-wordy-200 to-wordy-400 text-wordy-900 font-display text-lg rounded-lg border border-wordy-600 shadow-tile transition-transform active:translate-y-1"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Fed-today summary */}
        {dailyState.wordsFed.length > 0 && (
          <div className="mt-4 bg-white/60 border border-wordy-200 rounded-xl p-3">
            <p className="text-[11px] tracking-wide font-bold text-wordy-700 uppercase mb-1.5">fed today</p>
            <div className="flex flex-wrap gap-1.5">
              {dailyState.wordsFed.map((w, i) => (
                <span key={i} className="bg-wordy-200 text-wordy-800 text-xs font-display px-2.5 py-0.5 rounded-full border border-wordy-400">
                  {w.word}
                </span>
              ))}
            </div>
            <p className="text-xs text-wordy-700 mt-2">Today's score: <strong>{dailyState.score}</strong></p>
          </div>
        )}

        {/* Footer hint */}
        <p className="text-center text-[11px] italic text-wordy-600 mt-6">
          A new craving every day. {petInfo.name} grows the more you feed her.
        </p>
      </div>
    </div>
  )
}

// ───────── Helpers ─────────

/** Reconstruct combined rule arrays for each phase from a generated puzzle. */
function buildPhaseRules(puzzle) {
  const base = RULES_BY_ID[puzzle.base.id]
  if (!base) {
    console.error('[GameView] unknown base rule id', puzzle.base.id)
    return []
  }
  // Each phase's label is "<base> · <length> [· <bonus>]". Extract len + bonus
  // from the labels we stored. If the labels can't be parsed (shouldn't
  // happen for puzzles we generated), fall back to phase 1 = base only.
  const out = [{ label: base.label, rules: [base] }]

  const p2 = parsePhaseLabel(puzzle.phases[1].label)
  if (p2) {
    const lenMod = lengthMinModifier(p2.lenMin)
    out.push({ label: puzzle.phases[1].label, rules: [base, lenMod] })
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

/** Parse "<base> · 4+ letters" or "<base> · 5+ letters · ends in a vowel". */
function parsePhaseLabel(label) {
  const parts = label.split(' · ')
  if (parts.length < 2) return null
  const lenMatch = parts[1].match(/(\d+)\+ letters/)
  if (!lenMatch) return null
  return {
    lenMin: parseInt(lenMatch[1], 10),
    bonusLabel: parts[2] || null,
  }
}

/** Returns 1, 2, or 3 — the highest phase whose combined rule matches the word. */
function highestMatchingPhase(word, phaseRules) {
  const w = word.toUpperCase()
  for (let i = 2; i >= 0; i--) {
    if (phaseRules[i].rules.every((r) => r.matches(w))) return i + 1
  }
  return 0
}

/** Predict whether THIS feed completes all 3 phases (for the persistence flag). */
function predictCompletion(phaseCounts, matchedPhase) {
  const next = phaseCounts.slice()
  if (matchedPhase >= 1) next[matchedPhase - 1]++
  return next.every((c) => c >= 3)
}

function PhaseDot({ count, active }) {
  const filled = count >= 3
  const ringColour = active ? 'ring-2 ring-wordy-500' : ''
  return (
    <div
      className={`w-12 h-2.5 rounded-full ${filled ? 'bg-wordy-600' : 'bg-wordy-200'} ${ringColour} flex items-center justify-end pr-1`}
    >
      {!filled && count > 0 && (
        <span className="text-[8px] font-bold text-wordy-700">{count}/3</span>
      )}
    </div>
  )
}

function growthLabel(petInfo) {
  return `${petInfo.stage}`
}

function CravingBanner({ puzzle, activePhase, isComplete, petName }) {
  if (isComplete) return null
  const phase = puzzle.phases[activePhase]
  return (
    <div className="bg-gradient-to-br from-yellow-300 to-amber-500 text-white border-2 border-amber-700 rounded-2xl p-3 shadow-tile text-center">
      <p className="font-bold text-[10px] tracking-widest opacity-90">{petName.toUpperCase()}'S CRAVING (PHASE {activePhase + 1})</p>
      <p className="font-display text-base mt-0.5">{phase.label}</p>
    </div>
  )
}

function CompleteCard({ petName, score, wordsFed }) {
  return (
    <div className="card p-5 text-center my-3">
      <p className="font-display text-xl text-wordy-800 mb-1">{petName} is full 🌙</p>
      <p className="text-sm text-wordy-700 mb-2">See you tomorrow.</p>
      <p className="text-sm text-wordy-700">Today's score: <strong>{score}</strong></p>
      {wordsFed.length > 0 && (
        <p className="text-xs text-wordy-600 mt-2 italic">
          You fed her: {wordsFed.join(', ')}
        </p>
      )}
    </div>
  )
}
