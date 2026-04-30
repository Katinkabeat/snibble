// ────────────────────────────────────────────────────────────
//  SanctuaryView — Pokemon-style grid of pet cards.
//
//  Header (shared SnibbleHeader) + sub-header with title and
//  "X / Y raised" counter, then a responsive grid of PetCards.
//  Tapping a card opens PetModal with that pet's stats.
// ────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useSanctuary } from '../hooks/useSanctuary.js'
import SnibbleHeader from './SnibbleHeader.jsx'
import PetCard from './PetCard.jsx'
import PetModal from './PetModal.jsx'
import { SQLobbyShell } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function SanctuaryView({ user, onBack }) {
  const { pets, raisedCount, total, loading, error } = useSanctuary(user.id)
  const [selectedPet, setSelectedPet] = useState(null)

  return (
    <SQLobbyShell header={<SnibbleHeader user={user} />}>
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-display text-2xl text-wordy-800 dark:text-wordy-100">Your Sanctuary</h1>
          {!loading && (
            <p className="text-xs text-wordy-500 mt-0.5">{raisedCount} / {total} raised</p>
          )}
        </div>
        <button
          onClick={onBack}
          className="text-sm text-wordy-600 hover:text-wordy-800 dark:text-wordy-300 dark:hover:text-wordy-100"
        >
          ← Back
        </button>
      </div>

      {loading && (
        <div className="card p-5 text-center">
          <p className="italic text-wordy-500">Loading sanctuary…</p>
        </div>
      )}

      {error && (
        <div className="card p-5 text-center">
          <p className="text-rose-600 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} onClick={() => setSelectedPet(pet)} />
          ))}
        </div>
      )}

      {selectedPet && <PetModal pet={selectedPet} onClose={() => setSelectedPet(null)} />}
    </SQLobbyShell>
  )
}
