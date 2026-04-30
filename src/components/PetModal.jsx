// ────────────────────────────────────────────────────────────
//  PetModal — opens when a sanctuary card is tapped.
//
//  Shows the back of the card: status pill + stat rows.
//  Locked variant just shows the hint and nothing else.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import Mossy from './pets/Mossy.jsx'
import Pip from './pets/Pip.jsx'
import Mochi from './pets/Mochi.jsx'

const PET_COMPONENTS = { mossy: Mossy, pip: Pip, mochi: Mochi }

function deriveStage(growth) {
  if (growth >= 21) return 'adult'
  if (growth >= 11) return 'adolescent'
  return 'baby'
}

export default function PetModal({ pet, onClose }) {
  // Pop-in transition — start from 0 then flip to 1 next tick.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const PetSvg = PET_COMPONENTS[pet.id]
  const isLocked = pet.status === 'locked'
  const isGraduated = pet.status === 'graduated'
  const isActive = pet.status === 'active'

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative card p-6 w-full max-w-sm flex flex-col min-h-[600px] transition-all duration-300 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        } ${isLocked ? '!bg-[#1a1130] !border-[#2d1b55]' : ''}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full transition-colors ${
            isLocked ? 'bg-[#2d1b55] text-wordy-300 hover:bg-[#3d2070]' : 'bg-wordy-100 text-wordy-700 hover:bg-wordy-200'
          }`}
          aria-label="Close"
        >
          ×
        </button>

        {/* Pet art panel */}
        <div className={`w-full aspect-[16/10] rounded-xl grid place-items-center mb-4 overflow-hidden ${
          isLocked ? 'bg-[#0f0a1e]' : 'bg-gradient-to-br from-wordy-50 to-pink-50 dark:from-[#1a1130] dark:to-[#221540]'
        }`}>
          {isLocked ? (
            <span className="font-display text-7xl text-wordy-800">?</span>
          ) : PetSvg ? (
            <PetSvg stage={isGraduated ? 'adult' : deriveStage(pet.growth)} className="w-2/3 h-2/3 snibble-pet" />
          ) : (
            <span className="font-display text-5xl text-wordy-400">×</span>
          )}
        </div>

        {/* Title block */}
        <h2 className={`font-display text-2xl ${isLocked ? 'text-wordy-300 italic' : 'text-wordy-800 dark:text-wordy-100'}`}>
          {isLocked ? '???' : pet.name}
        </h2>
        {!isLocked && (
          <p className="text-xs text-wordy-500 dark:text-wordy-400 mb-3 lowercase">the {pet.species}</p>
        )}

        {/* Status pill */}
        <div className="mb-4">
          {isActive && (
            <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-wordy-100 text-wordy-700 dark:bg-[#2d1b55] dark:text-wordy-200">
              ● Growing
            </span>
          )}
          {isGraduated && (
            <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
              ★ Graduated
            </span>
          )}
          {isLocked && (
            <span className="inline-block px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-[#2d1b55] text-wordy-400">
              🔒 Locked
            </span>
          )}
        </div>

        {/* Locked: hint only — center in remaining vertical space so the
            modal matches the active/graduated height. */}
        {isLocked && pet.hintText && (
          <div className="flex-1 grid place-items-center">
            <div className="rounded-xl p-4 bg-[#2d1b55] text-wordy-200 italic text-sm leading-relaxed text-center">
              "{pet.hintText}"
            </div>
          </div>
        )}

        {/* Active / graduated: stats */}
        {!isLocked && (
          <div className="space-y-0">
            <StatRow k="Days fed" v={`${pet.growth} / ${pet.growthRequired}`} />
            {isActive && (
              <div className="pb-3">
                <div className="h-2 rounded-full bg-wordy-100 dark:bg-[#221540] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 to-wordy-500"
                    style={{ width: `${Math.min(100, (pet.growth / pet.growthRequired) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <StatRow k="Total words fed" v={pet.totalWordsFed} />
            <StatRow k="Longest word" v={pet.longestWord ? pet.longestWord.toUpperCase() : '—'} />
            <StatRow
              k="Favorite word"
              v={
                pet.favoriteWord ? (
                  <>
                    {pet.favoriteWord.toUpperCase()}{' '}
                    <span className="text-wordy-400 font-normal">×{pet.favoriteCount}</span>
                  </>
                ) : '—'
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

function StatRow({ k, v }) {
  return (
    <div className="flex justify-between items-baseline py-2.5 border-t border-wordy-100 dark:border-[#2d1b55] text-sm">
      <span className="text-wordy-500 dark:text-wordy-400">{k}</span>
      <span className="text-wordy-800 dark:text-wordy-100 font-bold">{v}</span>
    </div>
  )
}
