// Supabase Edge Function: Snibble Push Notifications
//
// Trigger / call types:
//   1. opponent_joined  — DB trigger on sn_matches when opponent_id
//                          flips null → not null. Notifies the creator.
//   2. round_submitted  — DB trigger on every sn_match_round_plays
//                          insert. Notifies the OTHER player. If the
//                          match auto-completed with this insert,
//                          appends "Match complete!" to the body.
//   3. match_invited    — DB trigger on sn_matches INSERT when
//                          invited_user_id is set. Notifies the invitee.
//   4. nudge            — client POST after the sn_nudge RPC, which
//                          enforces caller-in-match + caller-already-
//                          submitted-this-round + 12h cooldown and
//                          returns the target's user_id.
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

// Helper: respect the recipient's notification prefs before sending.
// Calls sq_notification_enabled(user, app, topic) — if false, skip
// the send entirely. Fail-open on RPC error so a transient DB blip
// doesn't break the platform.
async function sendIfOptedIn(
  supabase: any,
  userId: string,
  app: string,
  topic: string,
  payload: { title: string; body: string; tag: string; url: string; icon?: string }
): Promise<{ sent: boolean; reason?: string; via?: string }> {
  const { data: enabled, error } = await supabase.rpc('sq_notification_enabled', {
    p_user_id: userId,
    p_app: app,
    p_topic: topic,
  })
  if (error) {
    console.error('sq_notification_enabled failed (fail-open):', error)
  } else if (enabled === false) {
    return { sent: false, reason: 'opted out' }
  }
  return sendPushToUser(supabase, userId, payload, topic)
}

async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: { title: string; body: string; tag: string; url: string; icon?: string },
  topic = 'unknown'
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
        await reportAddressDeath('Snibble', userId, app, topic, pushErr.statusCode, sub.endpoint)
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

// Rotating quips for the invite_declined push — funny / bird / dog / ADHD
// flavoured, all warm rather than blunt. One picked at random per send.
// Rae-approved set (2026-05-31).
function declineBody(name: string, emoji: string): string {
  const quips = [
    `${name} flew the coop.`,
    `${name} chickened out.`,
    `${name} ducked out.`,
    `${name}'s not your wingman today.`,
    `${name} chased a squirrel instead.`,
    `${name} rolled over and bailed.`,
    `${name}'s in the doghouse.`,
    `${name} buried this one in the yard.`,
    `${name} got distracted by something shiny.`,
    `${name}'s brain changed the channel.`,
    `Ooh, squirrel — ${name}'s gone.`,
    `${name} flew south for this one.`,
  ]
  const quip = quips[Math.floor(Math.random() * quips.length)]
  return `${quip} Tap to start another. ${emoji}`
}

// Report an unexpected push-function failure to the private #error-log channel
// (c266 Phase 3). Best-effort; never throws. Only the top-level catch calls it,
// so routine 410/404 expired-subscription cleanup (handled inline) never lands here.
const ERRORLOG_WEBHOOK = Deno.env.get('SQ_DISCORD_ERRORLOG_WEBHOOK') ?? ''

// Report an expired-and-deleted push address to #error-log as a low-noise FYI
// (c268). A 410/404 on a *previously-valid* subscription silently darkens a
// real player — the exact blind spot that let Rae's turn pushes vanish for a
// day unnoticed. Distinct from reportServerError (a red alarm from the top-level
// catch): the SW self-heal (c252) + refresh-on-play (c270) re-create the address
// on the next rotation / hub-open / play, so this is an FYI, not an alarm.
async function reportAddressDeath(
  game: string, userId: string, app: string, topic: string, statusCode: number, endpoint: string
) {
  if (!ERRORLOG_WEBHOOK) return
  let host = 'unknown'
  try { host = new URL(endpoint).host } catch (_e) { /* keep 'unknown' */ }
  try {
    await fetch(ERRORLOG_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Rook',
        content: `**${game}** — push address expired (FYI)\n\`${statusCode} → sub deleted\` app:\`${app}\` topic:\`${topic}\` user:\`${userId}\` endpoint:\`${host}\`\nSelf-heal re-subscribes on next rotation / hub-open / play.`,
        allowed_mentions: { parse: [] },
      }),
    })
  } catch (_e) {
    // best-effort: a failed report must never mask the push flow
  }
}

async function reportServerError(game: string, type: string, detail: string) {
  if (!ERRORLOG_WEBHOOK) return
  try {
    await fetch(ERRORLOG_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Rook',
        content: `**${game}** — push function error\n\`${type}\`\ndetail: ${String(detail ?? '').slice(0, 500)}`,
        allowed_mentions: { parse: [] },
      }),
    })
  } catch (_e) {
    // best-effort: a failed report must never mask the original error
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let payload: any = null
  try {
    payload = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── match_invited: sn_matches INSERT with invited_user_id set ──
    if (payload.type === 'match_invited') {
      const { record } = payload
      if (!record?.id || !record.creator_id || !record.invited_user_id) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }

      const inviterName = await getUsername(supabase, record.creator_id)
      const result = await sendIfOptedIn(supabase, record.invited_user_id, 'snibble', 'invite', {
        title: 'Snibble — match invite',
        body: `${inviterName} invited you to a match. Tap to play! 🍃`,
        tag: `snibble-invite-${record.id}`,
        url: `/snibble/?match=${record.id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── nudge: client POST after sn_nudge RPC succeeds ──
    if (payload.type === 'nudge') {
      const { match_id, target_user_id, nudger_name } = payload
      if (!match_id || !target_user_id) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }

      const result = await sendIfOptedIn(supabase, target_user_id, 'snibble', 'nudge', {
        title: "Snibble — your turn!",
        body: `${nudger_name || 'Someone'} is waiting on your round! 🔔`,
        tag: `snibble-nudge-${match_id}`,
        url: `/snibble/?match=${match_id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── invite_declined (from sn_decline_invite RPC) ───────────
    // Snibble invites are 1v1, so a decline always closes the match.
    // Gated by the creator's 'invite_declined' pref (default OFF).
    if (payload.type === 'invite_declined') {
      const { match_id, creator_id, decliner_id } = payload
      if (!creator_id) {
        return new Response(JSON.stringify({ skipped: 'no creator' }), { status: 200, headers: corsHeaders })
      }
      const declinerName = decliner_id ? await getUsername(supabase, decliner_id) : 'A friend'
      const result = await sendIfOptedIn(supabase, creator_id, 'snibble', 'invite_declined', {
        title: 'Snibble',
        body: declineBody(declinerName, '🍃'),
        tag: `snibble-declined-${match_id}`,
        url: `/snibble/`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── game_closed: sn_expire_stale_matches closed a never-joined match ─
    // 1v1 invite expired before the opponent joined. One recipient: the
    // creator. (c151 baseline)
    if (payload.type === 'game_closed') {
      const { record } = payload
      if (!record?.id || !record.creator_id) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }
      const result = await sendIfOptedIn(supabase, record.creator_id, 'snibble', 'game_closed', {
        title: 'Snibble — match closed',
        body: 'Your match closed because no one else joined in time. 🍃',
        tag: `snibble-closed-${record.id}`,
        url: `/snibble/`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── opponent_joined: sn_matches UPDATE, opponent_id null → set ──
    if (payload.type === 'opponent_joined') {
      const { record } = payload
      if (!record?.id || !record.creator_id || !record.opponent_id) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }

      const joinerName = await getUsername(supabase, record.opponent_id)
      const result = await sendIfOptedIn(supabase, record.creator_id, 'snibble', 'opponent_joined', {
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
        .select('id, creator_id, opponent_id, status')
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
      const totalRounds = 1

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

      const result = await sendIfOptedIn(supabase, recipientId, 'snibble', 'your_turn', {
        title: matchComplete ? 'Snibble — match complete!' : 'Snibble — opponent played',
        body,
        tag: `snibble-play-${match.id}-${record.round_index}`,
        url: `/snibble/?match=${match.id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    // ── game_finished: sn_matches in_progress → completed via claim/forfeit ──
    // Fires only when end_reason is set (the trigger gates on it), so a normal
    // last-round completion (covered by round_submitted) never double-pushes.
    if (payload.type === 'game_finished') {
      const { record } = payload
      if (!record?.id || !record.winner_id || !record.end_reason) {
        return new Response(JSON.stringify({ skipped: 'missing fields' }), { status: 200, headers: corsHeaders })
      }
      const winnerId = record.winner_id
      const loserId = record.creator_id === winnerId ? record.opponent_id : record.creator_id
      if (!loserId) {
        return new Response(JSON.stringify({ skipped: 'no opponent' }), { status: 200, headers: corsHeaders })
      }

      // claim   → notify the LOSER (claimed against while idle)
      // forfeit → notify the WINNER (their opponent gave up)
      const isClaim = record.end_reason === 'claim'
      const recipientId = isClaim ? loserId : winnerId

      let title: string, body: string
      if (isClaim) {
        title = 'Snibble — match over'
        body = `${await getUsername(supabase, winnerId)} claimed the win because your turn was idle 7+ days.`
      } else {
        title = 'Snibble — you won!'
        body = `${await getUsername(supabase, loserId)} forfeited, you win!`
      }

      const result = await sendIfOptedIn(supabase, recipientId, 'snibble', 'game_finished', {
        title,
        body,
        tag: `snibble-finish-${record.id}`,
        url: `/snibble/?match=${record.id}`,
        icon: '/snibble/favicon.svg',
      })
      return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ skipped: 'unknown type' }), { status: 200, headers: corsHeaders })
  } catch (err: any) {
    console.error('Snibble push notification error:', err)
    await reportServerError('Snibble', payload?.type ?? 'unknown', err?.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
