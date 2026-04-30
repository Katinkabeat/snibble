// ────────────────────────────────────────────────────────────
//  SnibbleAvatarMenu — identity dropdown for Snibble.
//
//  Visual chrome (button, surface, identity card, menu item rows) is
//  shared via sq-ui so Snibble's avatar menu matches Wordy/Rungles
//  exactly. The Stats item opens StatsModal (Daily Leaderboard +
//  My Stats tabs).
// ────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  SQAvatarButton,
  SQAvatarDropdown,
  SQAvatarMenuItem,
} from '../../../rae-side-quest/packages/sq-ui/index.js'
import StatsModal from './StatsModal.jsx'

export default function SnibbleAvatarMenu({ profile, user }) {
  const [open, setOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  return (
    <div className="relative">
      <SQAvatarButton
        profile={profile}
        ariaExpanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      <SQAvatarDropdown
        open={open}
        onClose={() => setOpen(false)}
        profile={profile}
        align="left"
      >
        <SQAvatarMenuItem
          onClick={() => {
            setOpen(false)
            setStatsOpen(true)
          }}
        >
          📊 Stats
        </SQAvatarMenuItem>
      </SQAvatarDropdown>
      {statsOpen && user && (
        <StatsModal user={user} onClose={() => setStatsOpen(false)} />
      )}
    </div>
  )
}
