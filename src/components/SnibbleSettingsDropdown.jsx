// ────────────────────────────────────────────────────────────
//  SnibbleSettingsDropdown
//
//  Per SQ conventions, app-specific settings only:
//    - Theme (placeholder)
//    - How to play (placeholder)
//    - Redo today (gated by admin-controlled flag)  ← testing-phase tool
//    - Admin (visible to admins): toggles + reset
//    - Log out (rose)
//
//  Account-level settings live on the hub.
// ────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { SQReportPlayer } from '../../../rae-side-quest/packages/sq-ui/index.js'
import { useTheme } from '../contexts/ThemeContext.jsx'
import toast from 'react-hot-toast'
import HowToPlayModal from './HowToPlayModal.jsx'

export default function SnibbleSettingsDropdown({ onClose, isAdmin }) {
  const { isDark, toggle: toggleTheme } = useTheme()
  const ref = useRef(null)
  const [redoEnabled, setRedoEnabled] = useState(false)
  const [redoLoading, setRedoLoading] = useState(true)
  const [resettingLeaderboard, setResettingLeaderboard] = useState(false)
  const [redoingToday, setRedoingToday] = useState(false)
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

  // Read the redo-today flag.
  useEffect(() => {
    let active = true
    supabase
      .from('sn_app_settings')
      .select('value')
      .eq('key', 'redo_today_enabled')
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setRedoEnabled(data?.value === true)
        setRedoLoading(false)
      })
    return () => { active = false }
  }, [])

  async function handleLogout() {
    try { await supabase.auth.signOut() } catch {}
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })
    window.location.replace('/games/')
  }

  async function handleRedoToday() {
    if (redoingToday) return
    setRedoingToday(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("Couldn't redo — please sign in again.")
      setRedoingToday(false)
      return
    }
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Halifax',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const { error } = await supabase
      .from('sn_daily_feeds')
      .delete()
      .eq('user_id', user.id)
      .eq('feed_date', today)
    if (error) {
      toast.error("Couldn't redo today — " + error.message)
      setRedoingToday(false)
      return
    }
    toast.success('Today reset — refreshing…')
    setTimeout(() => window.location.reload(), 600)
  }

  async function handleToggleRedoFlag() {
    const next = !redoEnabled
    setRedoEnabled(next) // optimistic
    const { error } = await supabase
      .from('sn_app_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', 'redo_today_enabled')
    if (error) {
      setRedoEnabled(!next) // rollback
      toast.error("Couldn't toggle: " + error.message)
      return
    }
    toast.success(next ? 'Redo today: ON for everyone' : 'Redo today: OFF')
  }

  async function handleResetLeaderboard() {
    if (resettingLeaderboard) return
    if (!window.confirm('Wipe ALL daily-score history for every player? This cannot be undone. Pet growth will be preserved.')) return
    setResettingLeaderboard(true)
    const { error } = await supabase.rpc('sn_admin_reset_leaderboard')
    setResettingLeaderboard(false)
    if (error) {
      toast.error("Couldn't reset: " + error.message)
      return
    }
    toast.success('Leaderboard wiped.')
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
          ❓ Open
        </button>
      </div>

      {/* Redo today — visible to everyone IF admin has the flag on.
          Used during testing so we don't have to wait until tomorrow
          to retest the daily loop. */}
      {!redoLoading && redoEnabled && (
        <div className="settings-row">
          <span className="text-sm font-bold text-wordy-600">Redo today</span>
          <button
            onClick={handleRedoToday}
            disabled={redoingToday}
            className="text-sm font-bold text-wordy-700 hover:text-wordy-500 transition-colors disabled:opacity-50"
          >
            🔄 Reset
          </button>
        </div>
      )}

      {/* Admin section — admin-only controls. Sits between How-to-play
          (or Redo if shown) and Log out, per the locked layout. */}
      {isAdmin && (
        <>
          <div className="settings-row">
            <span className="text-sm font-bold text-wordy-600">Allow redo today</span>
            <button
              onClick={handleToggleRedoFlag}
              className={`text-sm font-bold transition-colors ${
                redoEnabled
                  ? 'text-wordy-700 hover:text-wordy-500'
                  : 'text-wordy-400 hover:text-wordy-600'
              }`}
              title="Admin: lets all players redo their daily session"
            >
              {redoEnabled ? '✅ ON' : '⬜ OFF'}
            </button>
          </div>
          <div className="settings-row">
            <span className="text-sm font-bold text-wordy-600">Reset leaderboard</span>
            <button
              onClick={handleResetLeaderboard}
              disabled={resettingLeaderboard}
              className="text-sm font-bold text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50"
              title="Wipes all daily-feed history (used to clear test scores before public launch)"
            >
              🧹 Wipe
            </button>
          </div>
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
              🔐 Open
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
