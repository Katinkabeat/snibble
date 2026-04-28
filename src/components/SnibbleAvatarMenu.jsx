// ────────────────────────────────────────────────────────────
//  SnibbleAvatarMenu — matches Wordy's AvatarMenu exactly.
//
//  Identity dropdown (about the user, not about Snibble):
//    - Identity card (avatar + username + "Your profile")
//    - 📊 Stats link (placeholder — Snibble stats arrive in v2)
//
//  Name change / colour picker / password change live ONLY on the
//  hub, per SQ conventions.
// ────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

function getInitials(name) {
  return (name || '?').slice(0, 2).toUpperCase()
}

export default function SnibbleAvatarMenu({ profile }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const hue = profile?.avatar_hue ?? 270
  const name = profile?.username ?? '…'
  const initials = getInitials(name)

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile and stats"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs border-2 border-black/5 hover:brightness-110 transition-all"
        style={{ background: `hsl(${hue}, 70%, 55%)` }}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-60 bg-[#fff] dark:bg-[#241640] border border-[#e9d5ff] dark:border-[#6d28d9] rounded-xl shadow-lg z-50 py-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#e9d5ff] dark:border-[#6d28d9]">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs"
              style={{ background: `hsl(${hue}, 70%, 55%)` }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-wordy-700 text-sm truncate">{name}</div>
              <div className="text-xs text-wordy-500">Your profile</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              toast('Snibble stats coming in v2 — leaderboards land with matches.')
            }}
            className="w-full text-left px-3 py-2.5 text-sm hover:bg-wordy-50 dark:hover:bg-[#2d1b55] text-wordy-700 transition-colors"
          >
            📊 Stats
            <span className="ml-1 text-[10px] text-wordy-400">soon</span>
          </button>
        </div>
      )}
    </div>
  )
}
