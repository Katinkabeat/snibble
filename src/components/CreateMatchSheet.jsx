// ────────────────────────────────────────────────────────────
//  CreateMatchSheet — modal for picking match format and creating.
//
//  Single Round is enabled. Best of 3 is gated as "coming soon" until
//  Chunk 2 of the multiplayer build (one-at-a-time round reveal).
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createMatch } from '../lib/matchActions.js'

export default function CreateMatchSheet({ user, onClose, onCreated }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleCreate(format) {
    if (submitting) return
    setSubmitting(true)
    try {
      const match = await createMatch({ userId: user.id, format })
      toast.success('Match posted — waiting for an opponent.')
      onCreated(match)
    } catch (err) {
      console.error('[createMatch] failed', err)
      toast.error(err.message || 'Failed to create match')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative card p-6 w-full max-w-sm transition-all duration-300 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-wordy-100 text-wordy-700 hover:bg-wordy-200 transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="font-display text-xl text-wordy-800 dark:text-wordy-100 mb-1">
          Start a match
        </h2>
        <p className="text-xs text-wordy-500 mb-5">
          Your match is posted publicly so anyone can join.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => handleCreate('single')}
            disabled={submitting}
            className="w-full card p-4 text-left hover:shadow-tile-hover transition-shadow disabled:opacity-60"
          >
            <p className="font-display text-base text-wordy-800 dark:text-wordy-100">Single round</p>
            <p className="text-xs text-wordy-600 dark:text-wordy-300 mt-0.5">
              One craving, two players, highest score wins.
            </p>
          </button>

          <button
            onClick={() => handleCreate('best_of_3')}
            disabled={submitting}
            className="w-full card p-4 text-left hover:shadow-tile-hover transition-shadow disabled:opacity-60"
          >
            <p className="font-display text-base text-wordy-800 dark:text-wordy-100">Best of 3</p>
            <p className="text-xs text-wordy-600 dark:text-wordy-300 mt-0.5">
              Three cravings revealed one at a time. Highest total wins.
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
