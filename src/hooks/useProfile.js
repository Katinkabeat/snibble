// ────────────────────────────────────────────────────────────
//  useProfile — read the user's SQ profile (username + avatar hue)
//  from the shared `profiles` table that all SideQuest games use.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('id, username, avatar_hue')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => active && setProfile(data || null))
    return () => { active = false }
  }, [userId])
  return profile
}
