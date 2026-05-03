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
import { useStreak } from '../hooks/useStreak.js'
import { useMatches } from '../hooks/useMatches.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import MultiplayerCard from './MultiplayerCard.jsx'
import CompletedMatchesSection from './CompletedMatchesSection.jsx'
import { PET_COMPONENTS } from '../lib/pets.jsx'
import { SQLobbyShell } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function LobbyView({ user, onPlayDaily, onOpenSanctuary, onOpenMatch }) {
  const { petInfo, loading: petLoading } = useActivePet(user.id)
  const { streak } = useStreak(user.id)
  const [puzzleTeaser, setPuzzleTeaser] = useState(null)
  const mine = useMatches(user.id)

  useEffect(() => {
    let active = true
    generateTodaysPuzzle()
      .then((p) => active && setPuzzleTeaser(p))
      .catch(() => {})
    return () => { active = false }
  }, [])

  const PetComponent = petInfo ? (PET_COMPONENTS[petInfo.petId] ?? PET_COMPONENTS.mossy) : null

  return (
    <SQLobbyShell header={<SnibbleHeader user={user} />}>
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
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl text-wordy-800 truncate">{petInfo.name}</h2>
                  {streak > 0 && (
                    <span
                      className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-wordy-200 text-wordy-700 text-xs font-bold"
                      title={`${streak}-day streak`}
                    >
                      Daily Streak 🔥 {streak}
                    </span>
                  )}
                </div>
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
        <section className="card">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl text-wordy-700">🌅 Today's Snibble</h2>
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
            <p className="text-sm text-wordy-600 mb-3">
              {petInfo?.name ?? 'Your pet'} wants{' '}
              <span className="font-bold text-wordy-800">{puzzleTeaser.base.label}</span> today.
            </p>
          ) : (
            <p className="text-sm text-wordy-500 italic mb-3">Loading today's puzzle…</p>
          )}
          <button onClick={onPlayDaily} className="btn-primary text-sm font-display">
            ▶ Play
          </button>
        </section>

        <MultiplayerCard
          user={user}
          mine={mine}
          onOpenMatch={(m) => onOpenMatch(m.id)}
        />

        {/* Sanctuary — Pokemon-style pet collection */}
        <section className="card">
          <h2 className="font-display text-xl text-wordy-700 mb-1">🌿 Sanctuary</h2>
          <p className="text-sm text-wordy-600 mb-3">
            Meet the pets you've raised — and a few who haven't shown themselves yet.
          </p>
          <button onClick={onOpenSanctuary} className="btn-secondary text-sm font-display">
            Open →
          </button>
        </section>

        {!mine.loading && (
          <CompletedMatchesSection
            matches={mine.completed}
            onView={(m) => onOpenMatch(m.id)}
          />
        )}
    </SQLobbyShell>
  )
}
