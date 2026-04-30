// ────────────────────────────────────────────────────────────
//  useSanctuary — loads the full pet roster + the user's
//  per-pet aggregates for the Sanctuary screen.
//
//  For each pet returns:
//    status       : 'active' | 'graduated' | 'locked'
//    growth       : sn_progress.growth (or 0 if locked)
//    growthRequired
//    totalWordsFed: sum of words_fed lengths across all sessions
//    longestWord  : longest word ever fed to that pet
//    favoriteWord : most-frequently fed word (ties broken by length)
//    favoriteCount: how many times the favorite was fed
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { PET_HINTS } from '../lib/petHints.js'

export function useSanctuary(userId) {
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      setLoading(true)
      try {
        const [{ data: petRows, error: petsErr }, { data: progressRows, error: progErr }, { data: feedRows, error: feedsErr }] = await Promise.all([
          supabase.from('sn_pets').select('id, name, species, unlock_order, growth_required, description').order('unlock_order', { ascending: true }),
          supabase.from('sn_progress').select('pet_id, growth, graduated_at, started_at').eq('user_id', userId),
          supabase.from('sn_daily_feeds').select('pet_id, words_fed').eq('user_id', userId),
        ])
        if (petsErr) throw petsErr
        if (progErr) throw progErr
        if (feedsErr) throw feedsErr

        const progressByPet = new Map()
        for (const row of progressRows ?? []) progressByPet.set(row.pet_id, row)

        const feedsByPet = new Map()
        for (const row of feedRows ?? []) {
          const list = feedsByPet.get(row.pet_id) ?? []
          list.push(...(row.words_fed ?? []))
          feedsByPet.set(row.pet_id, list)
        }

        const merged = (petRows ?? []).map((pet) => {
          const prog = progressByPet.get(pet.id)
          const status = !prog ? 'locked' : prog.graduated_at ? 'graduated' : 'active'
          const words = feedsByPet.get(pet.id) ?? []
          const stats = aggregateWords(words)
          return {
            id: pet.id,
            name: pet.name,
            species: pet.species,
            unlockOrder: pet.unlock_order,
            growthRequired: pet.growth_required ?? 30,
            hintText: PET_HINTS[pet.id] ?? null,
            description: pet.description,
            status,
            growth: prog?.growth ?? 0,
            graduatedAt: prog?.graduated_at ?? null,
            totalWordsFed: words.length,
            longestWord: stats.longest,
            favoriteWord: stats.favorite,
            favoriteCount: stats.favoriteCount,
          }
        })

        if (!active) return
        setPets(merged)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useSanctuary] load failed', err)
        setError(err.message || 'Failed to load sanctuary')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [userId])

  const raisedCount = pets.filter((p) => p.status !== 'locked').length
  const graduatedCount = pets.filter((p) => p.status === 'graduated').length
  return { pets, raisedCount, graduatedCount, total: pets.length, loading, error }
}

function aggregateWords(words) {
  if (!words.length) return { longest: null, favorite: null, favoriteCount: 0 }
  let longest = words[0]
  const counts = new Map()
  for (const w of words) {
    if (w.length > longest.length) longest = w
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  let favorite = null
  let favoriteCount = 0
  for (const [word, count] of counts) {
    if (count > favoriteCount || (count === favoriteCount && favorite && word.length > favorite.length)) {
      favorite = word
      favoriteCount = count
    }
  }
  return { longest, favorite, favoriteCount }
}
