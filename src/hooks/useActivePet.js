// ────────────────────────────────────────────────────────────
//  useActivePet — reads the user's current ungraduated pet from
//  sn_progress, falling back to the starter (Mossy) on first
//  visit. Also returns the visible growth stage derived from
//  the growth meter.
//
//  Stage thresholds (sessions, out of 30):
//    0–10  → baby
//    11–20 → adolescent
//    21–30 → adult
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const STARTER_PET_ID = 'mossy'
const GROWTH_REQUIRED = 30

function deriveStage(growth) {
  if (growth >= 21) return 'adult'
  if (growth >= 11) return 'adolescent'
  return 'baby'
}

export function useActivePet(userId) {
  const [petInfo, setPetInfo] = useState(null) // { petId, name, growth, stage, progressRow, petRow }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    let active = true

    async function load() {
      setLoading(true)
      try {
        // One query via PostgREST embedded resource — pulls the user's
        // current ungraduated pet AND its catalog row in a single round
        // trip. Saves one network hop on every lobby mount.
        const { data: progressRows, error: progErr } = await supabase
          .from('sn_progress')
          .select(`
            user_id, pet_id, growth, graduated_at, started_at,
            sn_pets ( id, name, species, unlock_order, growth_required )
          `)
          .eq('user_id', userId)
          .is('graduated_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
        if (progErr) throw progErr

        let progressRow = progressRows && progressRows[0]
        let petRow = progressRow?.sn_pets ?? null

        // First-visit case — adopt Mossy. We need the pet row separately
        // here since the insert doesn't embed and this is a rare path.
        if (!progressRow) {
          const [{ data: inserted, error: insertErr }, { data: starter, error: starterErr }] = await Promise.all([
            supabase.from('sn_progress')
              .insert({ user_id: userId, pet_id: STARTER_PET_ID, growth: 0 })
              .select().single(),
            supabase.from('sn_pets')
              .select('id, name, species, unlock_order, growth_required')
              .eq('id', STARTER_PET_ID).single(),
          ])
          if (insertErr) throw insertErr
          if (starterErr) throw starterErr
          progressRow = inserted
          petRow = starter
        }

        if (!active) return
        setPetInfo({
          petId: progressRow.pet_id,
          name: petRow.name,
          species: petRow.species,
          growth: progressRow.growth,
          growthRequired: petRow.growth_required ?? GROWTH_REQUIRED,
          stage: deriveStage(progressRow.growth),
          progressRow,
          petRow,
        })
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('[useActivePet] load failed', err)
        setError(err.message || 'Failed to load pet')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [userId])

  /**
   * Increment the pet's growth meter by 1. If it reaches the threshold,
   * mark the current pet graduated and adopt the next one.
   *
   * Returns the new pet info (after possible swap) so the UI can react.
   */
  async function tickGrowth() {
    if (!petInfo) return null
    const nextGrowth = petInfo.growth + 1
    const isMaturing = nextGrowth >= petInfo.growthRequired

    if (!isMaturing) {
      const { error: updErr } = await supabase
        .from('sn_progress')
        .update({ growth: nextGrowth })
        .eq('user_id', userId)
        .eq('pet_id', petInfo.petId)
      if (updErr) throw updErr
      const next = { ...petInfo, growth: nextGrowth, stage: deriveStage(nextGrowth) }
      setPetInfo(next)
      return next
    }

    // Mature — graduate this pet and adopt the next.
    const { error: gradErr } = await supabase
      .from('sn_progress')
      .update({ growth: nextGrowth, graduated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('pet_id', petInfo.petId)
    if (gradErr) throw gradErr

    // Find the next unlocked pet by unlock_order.
    const { data: nextPetRow } = await supabase
      .from('sn_pets')
      .select('id, name, species, unlock_order, growth_required')
      .gt('unlock_order', petInfo.petRow.unlock_order)
      .order('unlock_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    // No more pets left — collection complete (rare during v1, but handle).
    if (!nextPetRow) {
      const next = { ...petInfo, growth: nextGrowth, stage: 'adult', graduated: true }
      setPetInfo(next)
      return next
    }

    // Adopt the next pet.
    const { data: newProgress, error: newProgErr } = await supabase
      .from('sn_progress')
      .insert({ user_id: userId, pet_id: nextPetRow.id, growth: 0 })
      .select()
      .single()
    if (newProgErr) throw newProgErr

    const next = {
      petId: nextPetRow.id,
      name: nextPetRow.name,
      species: nextPetRow.species,
      growth: 0,
      growthRequired: nextPetRow.growth_required ?? GROWTH_REQUIRED,
      stage: 'baby',
      progressRow: newProgress,
      petRow: nextPetRow,
      justGraduatedFrom: petInfo.name,
    }
    setPetInfo(next)
    return next
  }

  return { petInfo, loading, error, tickGrowth }
}
