import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import PetPreview from './components/PetPreview.jsx'
import GameView from './components/GameView.jsx'
import { preloadDictionary } from './lib/dictionary.js'

// SQ hub URL — unauthed visitors get bounced here so the hub handles login.
// Includes a `return` query param so they come back to /snibble/ after.
const HUB_URL = '/games/'

// Returns the value of a single query-string parameter (or null).
function queryParam(name) {
  const m = window.location.search.match(new RegExp(`[?&]${name}=([^&]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let active = true

    // Kick off dictionary preload immediately so the puzzle generator
    // doesn't pay the load cost when the user lands on the game.
    preloadDictionary()

    // Read initial session.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setAuthChecked(true)
    })

    // Subscribe to changes (SSO sign-in elsewhere on the same origin).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!active) return
      setSession(sess ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // While we check, render nothing — avoids a flash.
  if (!authChecked) return null

  // No session → bounce to the SQ hub for sign-in. The hub handles the login
  // flow and redirects back to /snibble/ via its `?return=` query param.
  if (!session) {
    const here = window.location.pathname + window.location.search + window.location.hash
    const returnUrl = encodeURIComponent(here)
    window.location.replace(`${HUB_URL}?return=${returnUrl}`)
    return null
  }

  // Admin-only dev view for previewing pet artwork — anyone authed
  // can see it for now. We're behind the SQ admin gate via the hub
  // anyway during build mode.
  if (queryParam('view') === 'pets') return <PetPreview />

  // The actual game.
  return <GameView user={session.user} />
}

/**
 * Pre-launch placeholder. Until the actual game is built, anyone who reaches
 * /snibble/ (admins during build mode, everyone post-launch) sees this.
 * Swap this out for the real game once it ships.
 */
function PlaceholderShell({ user }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md w-full">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-wordy-300 to-wordy-500 shadow-tile">
          <span className="font-display text-4xl text-white">S</span>
        </div>
        <h1 className="font-display text-4xl text-wordy-800 mb-2">Snibble</h1>
        <p className="text-wordy-600 italic mb-6">A cozy daily word pet.</p>

        <div className="card p-5 mb-6">
          <p className="font-display text-lg text-wordy-800 mb-2">Under construction</p>
          <p className="text-sm text-wordy-700">
            Snibble is being built. There's nothing here yet, but soon
            you'll meet Mossy and feed her words while she grows.
          </p>
        </div>

        <a
          href={HUB_URL}
          className="inline-block px-5 py-2 rounded-xl bg-white/70 border border-wordy-300 text-wordy-700 font-bold hover:bg-white transition-colors"
        >
          ← Back to Side Quest
        </a>

        <p className="mt-8 text-xs text-wordy-500">
          Signed in as {user.email}
        </p>
      </div>
    </div>
  )
}
