// ────────────────────────────────────────────────────────────
//  SnibbleHeader — sticky top bar shared by Lobby + Game views.
//
//  Mirrors the Wordy / Side Quest hub aesthetic:
//   - Sticky white bar with thin wordy-100 border
//   - max-w-[480px] centered container
//   - Home button (back to SQ) on the left
//   - Snibble logo + 🌿 next to home
//   - Avatar (initial in coloured circle, using SQ profile data)
//   - Settings cog with a dropdown menu
// ────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useProfile } from '../hooks/useProfile.js'

export default function SnibbleHeader({ user }) {
  const profile = useProfile(user?.id)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Click-outside / Escape to close the dropdown.
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initial =
    (profile?.username?.[0] || user?.email?.[0] || '?').toUpperCase()
  const hue = Number.isFinite(profile?.avatar_hue) ? profile.avatar_hue : 270 // wordy purple default

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/games/'
  }

  return (
    <header className="bg-white border-b border-wordy-100 shadow-sm sticky top-0 z-20">
      <div className="max-w-[480px] mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
        {/* Left: home + logo */}
        <div className="flex items-center gap-2 min-w-0">
          <a
            href="/games/"
            title="Back to Side Quest"
            className="w-9 h-9 rounded-full grid place-items-center text-wordy-700 hover:bg-wordy-50 transition-colors"
            aria-label="Side Quest home"
          >
            <HomeIcon />
          </a>
          <span className="font-display text-xl text-wordy-700 leading-none">Snibble</span>
          <span className="text-lg leading-none">🌿</span>
        </div>

        {/* Right: avatar + cog */}
        <div ref={wrapRef} className="flex items-center gap-2 relative">
          <div
            className="w-9 h-9 rounded-full grid place-items-center text-white font-display text-base shadow-tile select-none"
            style={{ background: `hsl(${hue} 60% 55%)` }}
            title={profile?.username || user?.email || 'You'}
          >
            {initial}
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Settings"
            className="w-9 h-9 rounded-full grid place-items-center text-wordy-700 hover:bg-wordy-50 transition-colors"
          >
            <CogIcon />
          </button>

          {open && (
            <div
              className="absolute top-11 right-0 w-56 bg-white rounded-2xl border border-wordy-200 shadow-lg p-1.5 z-30"
            >
              <DropdownItem icon="❓" disabled>
                How to play
                <span className="ml-auto text-[10px] text-wordy-400">soon</span>
              </DropdownItem>
              <DropdownItem icon="🌿" onClick={() => { setOpen(false); window.location.href = '/games/' }}>
                Back to Side Quest
              </DropdownItem>
              <hr className="my-1 border-wordy-100" />
              <DropdownItem icon="🚪" onClick={signOut}>
                Sign out
              </DropdownItem>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function DropdownItem({ icon, children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm text-wordy-800 transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-wordy-50'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="flex-1 flex items-center">{children}</span>
    </button>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z"/>
    </svg>
  )
}

function CogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
