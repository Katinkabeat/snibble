// ────────────────────────────────────────────────────────────
//  LobbyView — Snibble's landing page. The "front door" the
//  player sees when they open the game from the SQ hub.
//
//  Shows their active pet, today's craving teaser, and the
//  available game modes (daily now, head-to-head match coming
//  in v2 as a greyed-out card).
//
//  Style mirrors Wordy's lobby — sticky white header, max-w-[480px]
//  container, card-based sections with display-font titles.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { generateTodaysPuzzle } from '../lib/cravingGenerator.js'
import { useActivePet } from '../hooks/useActivePet.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import Mossy from './pets/Mossy.jsx'
import Pip from './pets/Pip.jsx'
import Mochi from './pets/Mochi.jsx'

const PET_COMPONENTS = { mossy: Mossy, pip: Pip, mochi: Mochi }

export default function LobbyView({ user, onPlayDaily }) {
  const { petInfo, loading: petLoading } = useActivePet(user.id)
  const [puzzleTeaser, setPuzzleTeaser] = useState(null)

  useEffect(() => {
    let active = true
    generateTodaysPuzzle()
      .then((p) => active && setPuzzleTeaser(p))
      .catch(() => {})
    return () => { active = false }
  }, [])

  const PetComponent = petInfo ? (PET_COMPONENTS[petInfo.petId] ?? Mossy) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-wordy-50 via-pink-50 to-wordy-100">
      <SnibbleHeader user={user} />

      {/* Body */}
      <main className="max-w-[480px] mx-auto px-4 py-6 space-y-5">
        {/* Pet hero card */}
        {petLoading || !petInfo ? (
          <div className="card p-5 text-center">
            <p className="italic text-wordy-500">Finding your pet…</p>
          </div>
        ) : (
          <div className="card p-5">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 shrink-0 bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl border-2 border-wordy-300 grid place-items-center overflow-hidden">
                {PetComponent && (
                  <PetComponent
                    stage={petInfo.stage}
                    className="w-full h-full snibble-pet"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-2xl text-wordy-800 truncate">{petInfo.name}</h2>
                <p className="text-xs text-wordy-500 capitalize">
                  {petInfo.species} · {petInfo.stage}
                </p>
                <div className="mt-2">
                  <div className="h-2 bg-wordy-100 border border-wordy-300 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-300 to-wordy-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (petInfo.growth / petInfo.growthRequired) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-wordy-700 mt-1">
                    {petInfo.growth} of {petInfo.growthRequired} days fed
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily mode card */}
        <section>
          <h2 className="font-display text-xl text-wordy-700 mb-2 px-1">🌅 Today's Snibble</h2>
          <button
            onClick={onPlayDaily}
            className="w-full card p-5 text-left hover:shadow-tile-hover transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-lg text-wordy-800">Daily craving</p>
                  {puzzleTeaser && (
                    <span
                      className="text-xs"
                      title={`${puzzleTeaser.difficulty === 1 ? 'easy' : puzzleTeaser.difficulty === 2 ? 'medium' : 'hard'} day`}
                    >
                      <span className="text-amber-600">{'★'.repeat(puzzleTeaser.difficulty)}</span>
                      <span className="text-amber-200">{'★'.repeat(3 - puzzleTeaser.difficulty)}</span>
                    </span>
                  )}
                </div>
                {puzzleTeaser ? (
                  <p className="text-sm text-wordy-600 mt-1">
                    {petInfo?.name ?? 'Your pet'} wants{' '}
                    <span className="font-bold text-wordy-800">{puzzleTeaser.base.label}</span> today.
                  </p>
                ) : (
                  <p className="text-sm text-wordy-500 italic mt-1">Loading today's puzzle…</p>
                )}
                <p className="text-[11px] text-wordy-500 mt-2 italic">
                  Same puzzle for everyone today
                </p>
              </div>
              <div className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-br from-wordy-400 to-wordy-600 text-white text-sm font-display shadow-tile">
                Play →
              </div>
            </div>
          </button>
        </section>

        {/* Head-to-head match card — coming in v2 */}
        <section>
          <h2 className="font-display text-xl text-wordy-700 mb-2 px-1">🎮 Two-Player Match</h2>
          <div className="card p-5 opacity-60 cursor-not-allowed" aria-disabled="true">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg text-wordy-800">Head-to-head</p>
                <p className="text-sm text-wordy-600 mt-1">
                  Same craving + same letters. Highest score wins. No pets, just words.
                </p>
                <p className="text-[11px] text-wordy-500 mt-2 italic">
                  Single round or best of 3 · async like Wordy
                </p>
              </div>
              <div className="shrink-0 px-3 py-1.5 rounded-xl bg-wordy-200 text-wordy-700 text-xs font-display">
                Coming soon
              </div>
            </div>
          </div>
        </section>

        {/* Sanctuary placeholder — will become a real screen in a few iterations */}
        <section>
          <h2 className="font-display text-xl text-wordy-700 mb-2 px-1">🌿 Sanctuary</h2>
          <div className="card p-5 opacity-60 cursor-not-allowed" aria-disabled="true">
            <p className="text-sm text-wordy-700">
              {petInfo?.name ? `${petInfo.name} is still growing.` : 'Your meadow is empty for now.'}
            </p>
            <p className="text-[11px] text-wordy-500 mt-1 italic">
              Graduated pets will join the meadow here. Coming once the first pet matures.
            </p>
          </div>
        </section>

      </main>
    </div>
  )
}
