// ────────────────────────────────────────────────────────────
//  SnibbleAvatarMenu — identity dropdown for Snibble.
//
//  Visual chrome (button, surface, identity card, menu item rows) is
//  shared via sq-ui so Snibble's avatar menu matches Wordy/Rungles
//  exactly. Snibble-specific bit: the Stats action shows a "coming
//  in v2" toast since matchplay-based stats don't exist yet.
// ────────────────────────────────────────────────────────────

import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  SQAvatarButton,
  SQAvatarDropdown,
  SQAvatarMenuItem,
} from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function SnibbleAvatarMenu({ profile }) {
  const [open, setOpen] = useState(false)

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
            toast('Snibble stats coming in v2 — leaderboards land with matches.')
          }}
        >
          📊 Stats
          <span className="ml-1 text-[10px] text-wordy-400">soon</span>
        </SQAvatarMenuItem>
      </SQAvatarDropdown>
    </div>
  )
}
