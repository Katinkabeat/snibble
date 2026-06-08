// ────────────────────────────────────────────────────────────
//  SnibbleSettingsDropdown
//
//  Per SQ conventions, app-specific settings only:
//    - Theme
//    - How to play
//    - Admin panel (visible to admins)
//    - Report a player
//    - Log out (rose)
//
//  Canonical SQ settings order: Theme → How to play → Admin →
//  game rows → Report a player → Log out.
//  Account-level settings live on the hub.
// ────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SQReportPlayer } from '../../../rae-side-quest/packages/sq-ui/index.js'
import { useTheme } from '../contexts/ThemeContext.jsx'
import HowToPlayModal from './HowToPlayModal.jsx'

export default function SnibbleSettingsDropdown({ onClose, isAdmin }) {
  const { isDark, toggle: toggleTheme } = useTheme()
  const ref = useRef(null)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  // Click outside / Escape to close.
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
      {/* Theme — light / dark toggle, persisted in localStorage. */}
      <div className="settings-row">
        <span className="text-sm font-bold text-wordy-600">Theme</span>
        <button
          onClick={toggleTheme}
          className="text-sm font-bold text-wordy-700 hover:text-wordy-500 transition-colors"
        >
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* How to play — opens the HowToPlayModal. */}
      <div className="settings-row">
        <span className="text-sm font-bold text-wordy-600">How to play</span>
        <button
          onClick={() => setShowHowToPlay(true)}
          className="text-sm font-bold text-wordy-700 hover:text-wordy-500 transition-colors"
        >
          📖 Open
        </button>
      </div>

      {/* Admin panel — admin-only. Sits right after How to play, per the
          canonical SQ settings order. */}
      {isAdmin && (
        <>
          <div className="settings-row">
            <span className="text-sm font-bold text-wordy-600">Admin panel</span>
            <button
              onClick={() => {
                onClose()
                const url = `${window.location.pathname}?view=admin${window.location.hash}`
                window.history.pushState({}, '', url)
                window.dispatchEvent(new PopStateEvent('popstate'))
              }}
              className="text-sm font-bold text-wordy-700 hover:text-wordy-500 transition-colors"
              title="Open the admin panel (close stuck matches, etc.)"
            >
              Open
            </button>
          </div>
        </>
      )}

      {/* Report a player */}
      <SQReportPlayer supabase={supabase} game="snibble" />

      {/* Log out — rose, always last. */}
      <div className="settings-row">
        <button
          onClick={handleLogout}
          className="text-sm font-bold text-rose-500 hover:text-rose-700 transition-colors"
        >
          Log out
        </button>
      </div>

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  )
}
