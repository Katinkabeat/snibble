// ────────────────────────────────────────────────────────────
//  SnibbleSettingsDropdown — matches Wordy's SettingsModal.
//
//  Per SQ conventions, app-specific settings only:
//    - Theme toggle (placeholder for now — full dark mode lands later)
//    - How to play (placeholder — will be wired up once gameplay
//      is settled; user explicitly asked for this)
//    - Admin (gated by isAdmin)
//    - Log out (rose)
//
//  No name change / password change here — those live on the hub.
// ────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import toast from 'react-hot-toast'

export default function SnibbleSettingsDropdown({ onClose, isAdmin }) {
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function handleLogout() {
    try { await supabase.auth.signOut() } catch {}
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })
    window.location.replace('/games/')
  }

  return (
    <div ref={ref} className="settings-dropdown card">
      {/* Theme — placeholder until full dark mode lands across Snibble. */}
      <div className="settings-row">
        <span className="text-sm font-bold text-wordy-600">Theme</span>
        <button
          onClick={() => toast('Dark mode lands in the next polish pass.')}
          className="text-sm font-bold text-wordy-400 cursor-not-allowed"
          title="Coming soon"
        >
          🌙 Dark <span className="text-[10px]">soon</span>
        </button>
      </div>

      {/* How to play — placeholder, will be wired up once gameplay is settled. */}
      <div className="settings-row">
        <span className="text-sm font-bold text-wordy-600">How to play</span>
        <button
          onClick={() => toast("Snibble's how-to lands once we're done iterating on gameplay.")}
          className="text-sm font-bold text-wordy-400 cursor-not-allowed"
          title="Coming soon"
        >
          ❓ <span className="text-[10px]">soon</span>
        </button>
      </div>

      {/* Admin — gated. Snibble doesn't have an admin panel yet, so this
          is a placeholder that links into the SQ hub admin section. */}
      {isAdmin && (
        <div className="settings-row">
          <span className="text-sm font-bold text-wordy-600">Admin</span>
          <a
            href="/games/"
            className="text-sm font-bold text-wordy-700 hover:text-wordy-500 transition-colors"
          >
            🔐 Hub admin
          </a>
        </div>
      )}

      {/* Log out — rose colour everywhere, per conventions. */}
      <div className="settings-row">
        <button
          onClick={handleLogout}
          className="text-sm font-bold text-rose-500 hover:text-rose-700 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  )
}
