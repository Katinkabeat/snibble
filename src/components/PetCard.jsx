// ────────────────────────────────────────────────────────────
//  PetCard — one card in the Sanctuary grid.
//
//  Three states:
//    active    → pet art (full color) + name + progress bar
//    graduated → pet art (full color) + name + gold ribbon
//    locked    → dark card with `?`, name as ???
// ────────────────────────────────────────────────────────────

import { PET_COMPONENTS } from '../lib/pets.jsx'

function deriveStage(growth) {
  if (growth >= 21) return 'adult'
  if (growth >= 11) return 'adolescent'
  return 'baby'
}

export default function PetCard({ pet, onClick }) {
  const PetSvg = PET_COMPONENTS[pet.id]
  const isLocked = pet.status === 'locked'
  const isGraduated = pet.status === 'graduated'
  const isActive = pet.status === 'active'

  const baseClasses = 'relative card p-3 flex flex-col text-center cursor-pointer transition-transform hover:-translate-y-0.5 aspect-[3/4]'

  if (isLocked) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} !bg-wordy-900 !border-wordy-800 dark:!bg-[#0f0a1e] dark:!border-[#1a1130]`}
        aria-label={`Locked pet — ${pet.name}`}
      >
        <div className="flex-1 grid place-items-center rounded-xl bg-[#1a1130] dark:bg-[#0f0a1e]">
          <span className="font-display text-5xl text-wordy-700 dark:text-wordy-800">?</span>
        </div>
        <div className="mt-2 font-display italic text-sm text-wordy-500">???</div>
      </button>
    )
  }

  return (
    <button onClick={onClick} className={baseClasses} aria-label={pet.name}>
      {isGraduated && (
        <span className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md text-[10px] font-display tracking-wider uppercase text-white bg-gradient-to-br from-amber-400 to-amber-600 shadow">
          ★ Grad
        </span>
      )}
      <div className="flex-1 grid place-items-center rounded-xl bg-gradient-to-br from-wordy-50 to-pink-50 dark:from-[#1a1130] dark:to-[#221540] overflow-hidden">
        {PetSvg ? (
          <PetSvg stage={isGraduated ? 'adult' : deriveStage(pet.growth)} className="w-3/4 h-3/4 snibble-pet" />
        ) : (
          <span className="font-display text-4xl text-wordy-400">×</span>
        )}
      </div>
      <div className="mt-2">
        <div className="font-display text-sm text-wordy-800 dark:text-wordy-100 truncate">{pet.name}</div>
        {isActive && (
          <div className="mt-1.5">
            <div className="h-1.5 rounded-full bg-wordy-100 dark:bg-[#221540] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-wordy-500 rounded-full"
                style={{ width: `${Math.min(100, (pet.growth / pet.growthRequired) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-wordy-600 dark:text-wordy-300 mt-1">
              {pet.growth} / {pet.growthRequired} fed
            </div>
          </div>
        )}
        {isGraduated && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">Graduated</div>
        )}
      </div>
    </button>
  )
}
