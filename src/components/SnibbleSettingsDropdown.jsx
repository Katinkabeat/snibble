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
import { SQReportPlayer, SQSettingsRow } from '../../../rae-side-quest/packages/sq-ui/index.js'
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
      {/* Canonical SQ order: Theme → How to play → Admin → Report → Log out */}
      <SQSettingsRow
        label="Theme"
        control={isDark ? '☀️ Light' : '🌙 Dark'}
        onClick={toggleTheme}
      />
      <SQSettingsRow
        label="How to play"
        control="📖 Open"
        onClick={() => setShowHowToPlay(true)}
      />
      {isAdmin && (
        <SQSettingsRow
          label="Admin panel"
          control="Open"
          title="Open the admin panel (close stuck matches, etc.)"
          onClick={() => {
            onClose()
            const url = `${window.location.pathname}?view=admin${window.location.hash}`
            window.history.pushState({}, '', url)
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
        />
      )}
      <SQReportPlayer supabase={supabase} game="snibble" />
      <SQSettingsRow label="Log out" danger onClick={handleLogout} />

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  )
}
