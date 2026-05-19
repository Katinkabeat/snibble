// ────────────────────────────────────────────────────────────
//  SnibbleAvatarMenu — identity dropdown for Snibble.
//
//  Visual chrome shared via sq-ui so Snibble's avatar menu matches
//  Wordy/Rungles. The Stats item navigates to /snibble/?view=stats
//  (a full StatsPage), matching Yahdle's page-based pattern.
// ────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  SQAvatarButton,
  SQAvatarDropdown,
  SQAvatarMenuItem,
} from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function SnibbleAvatarMenu({ profile }) {
  const [open, setOpen] = useState(false)

  function goToStats() {
    setOpen(false)
    const newUrl = `${window.location.pathname}?view=stats${window.location.hash}`
    window.history.pushState({}, '', newUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

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
        <SQAvatarMenuItem onClick={goToStats}>
          📊 Stats
        </SQAvatarMenuItem>
      </SQAvatarDropdown>
    </div>
  )
}
