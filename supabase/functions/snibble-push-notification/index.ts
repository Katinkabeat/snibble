// Supabase Edge Function: Snibble Push Notifications
//
// Two trigger types from DB:
//   1. opponent_joined  — fires on sn_matches when opponent_id flips
//                          null → not null. Notifies the match creator.
//   2. round_submitted  — fires on every sn_match_round_plays insert.
//                          Notifies the OTHER player (not the submitter).
//                          If the match auto-completed with this insert,
//                          appends "Match complete!" to the body.
//
// Subscription fallback order: ['sidequest', 'snibble'] — most users
// have opted into notifications via the SQ hub (app='sidequest'), so
// that wins; per-game subscriptions would only exist if a user opted
// in directly inside Snibble (no UI for that yet, but supported).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_SUBJECT        = Deno.env.get('VAPID_SUBJECT')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: { title: string; body: string; tag: string; url: string; icon?: string }
): Promise<{ sent: boolean; reason?: string; via?: string }> {
  const apps = ['sidequest', 'snibble']
  for (const app of apps) {
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys_p256dh, keys_auth')
      .eq('user_id', userId)
      .eq('app', app)
      .maybeSingle()
    if (!sub) continue
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    }
    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload), { TTL: 86400 })
      return { sent: true, via: app }
    } catch (pushErr: any) {
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('app', app)
        continue
      }
      throw pushErr
    }
  }
  return { sent: false, reason: 'no push subscription' }
}

async function getUsername(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()
  return profile?.username ?? 'Someone'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── opponent_joined: sn_matches UPDATE, opponent_id null → set ──
    if (payload.type === 'opponent_joined') {
      const { record } = payload
      if (!record?.id || !record.creator_id || !record.opponent_id) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }

      const joinerName = await getUsername(supabase, record.opponent_id)
      const result = await sendPushToUser(supabase, record.creator_id, {
        title: 'Snibble — opponent joined!',
        body: `${joinerName} joined your match. Time to play! 🍃`,
        tag: `snibble-join-${record.id}`,
        url: `/snibble/?match=${record.id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── round_submitted: sn_match_round_plays INSERT ──
    if (payload.type === 'round_submitted') {
      const { record } = payload
      if (!record?.match_id || !record?.user_id || record.round_index == null) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }

      // Look up match to find the opponent (recipient).
      const { data: match } = await supabase
        .from('sn_matches')
        .select('id, creator_id, opponent_id, status, format')
        .eq('id', record.match_id)
        .single()
      if (!match) {
        return new Response(JSON.stringify({ skipped: 'match not found' }), { status: 200, headers: corsHeaders })
      }

      // Recipient = the other player.
      const recipientId = match.creator_id === record.user_id ? match.opponent_id : match.creator_id
      if (!recipientId) {
        return new Response(JSON.stringify({ skipped: 'no opponent yet' }), { status: 200, headers: corsHeaders })
      }

      const submitterName = await getUsername(supabase, record.user_id)
      const totalRounds = match.format === 'best_of_3' ? 3 : 1

      // Count plays directly so we don't depend on match.status being
      // updated yet — the client flips status='completed' AFTER the
      // play insert, and the Edge Function may run before that.
      const { data: plays } = await supabase
        .from('sn_match_round_plays')
        .select('user_id, round_index')
        .eq('match_id', match.id)
      const myCount = (plays ?? []).filter((p) => p.user_id === record.user_id).length
      const theirCount = (plays ?? []).filter((p) => p.user_id === recipientId).length
      const matchComplete = myCount >= totalRounds && theirCount >= totalRounds

      let body: string
      if (matchComplete) {
        body = `${submitterName} finished — match complete! 🏆`
      } else if (totalRounds > 1) {
        body = `${submitterName} finished round ${record.round_index + 1} of ${totalRounds}.`
      } else {
        body = `${submitterName} submitted their round.`
      }

      const result = await sendPushToUser(supabase, recipientId, {
        title: matchComplete ? 'Snibble — match complete!' : 'Snibble — opponent played',
        body,
        tag: `snibble-play-${match.id}-${record.round_index}`,
        url: `/snibble/?match=${match.id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ skipped: 'unknown type' }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error('Snibble push notification error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
