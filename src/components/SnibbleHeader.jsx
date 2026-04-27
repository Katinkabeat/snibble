// ────────────────────────────────────────────────────────────
//  SnibbleHeader — sticky app bar matching Wordy + SQ exactly per
//  rae-side-quest/docs/sq-conventions.md.
//
//  Layout:  [avatar]  [Snibble]  ...  [🏠]  [⚙️]
//
//  Both icons are plain emojis with hover-scale (NOT custom SVGs)
//  to match Wordy's playful aesthetic. The avatar carries identity;
//  no game-name glyph next to it.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useProfile } from '../hooks/useProfile.js'
import SnibbleAvatarMenu from './SnibbleAvatarMenu.jsx'
import SnibbleSettingsDropdown from './SnibbleSettingsDropdown.jsx'

export default function SnibbleHeader({ user }) {
  const profile = useProfile(user?.id)
  const [showSettings, setShowSettings] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => active && setIsAdmin(!!data))
    return () => { active = false }
  }, [user?.id])

  return (
    <header className="bg-white border-b border-wordy-100 shadow-sm sticky top-0 z-10">
      <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: avatar + game name */}
        <div className="flex items-center gap-2">
          <SnibbleAvatarMenu profile={profile} />
          <span className="font-display text-2xl text-wordy-700">Snibble</span>
        </div>

        {/* Right: home + cog */}
        <div className="flex items-center gap-3">
          <a
            href="/games/"
            className="text-2xl leading-none hover:scale-110 transition-transform"
            title="Rae's Side Quest"
            aria-label="Rae's Side Quest"
          >
            🏠
          </a>
          <div className="relative">
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="text-lg leading-none hover:scale-110 transition-transform text-wordy-500 hover:text-wordy-700"
              title="Settings"
            >
              ⚙️
            </button>
            {showSettings && (
              <SnibbleSettingsDropdown
                onClose={() => setShowSettings(false)}
                isAdmin={isAdmin}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
