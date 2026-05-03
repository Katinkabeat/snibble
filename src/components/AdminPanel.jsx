// Snibble admin panel — Close Matches view only. Admin permissions
// live in the shared `admins` table (managed from Wordy's panel).

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import SnibbleHeader from './SnibbleHeader.jsx'

export default function AdminPanel({ user, onBack }) {
  const [matches, setMatches]       = useState([])
  const [closingId, setClosingId]   = useState(null)
  const [reasonFor, setReasonFor]   = useState(null)
  const [reasonText, setReasonText] = useState('')
  const [loading, setLoading]       = useState(true)

  const loadMatches = useCallback(async () => {
    const { data, error } = await supabase.rpc('sn_admin_list_open_matches')
    if (error) {
      console.error('sn_admin_list_open_matches failed:', error)
      toast.error(`Couldn't load matches: ${error.message}`)
    }
    setMatches(data ?? [])
  }, [])

  useEffect(() => {
    setLoading(true)
    loadMatches().finally(() => setLoading(false))
  }, [loadMatches])

  function startClose(matchId) {
    setReasonFor(matchId)
    setReasonText('')
  }

  function cancelClose() {
    setReasonFor(null)
    setReasonText('')
  }

  async function confirmClose(matchId) {
    const reason = reasonText.trim()
    if (!reason) {
      toast.error('Please enter a reason for closing this match.')
      return
    }
    setClosingId(matchId)
    try {
      const { error } = await supabase.rpc('sn_admin_close_match', { p_match_id: matchId, p_reason: reason })
      if (error) throw error
      toast.success('Match closed.')
      setMatches(prev => prev.filter(m => m.id !== matchId))
      cancelClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setClosingId(null)
    }
  }

  return (
    <>
      <SnibbleHeader user={user} />
      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-wordy-600 hover:text-wordy-800"
        >
          ← Back to lobby
        </button>
        <section className="card">
          <h2 className="font-display text-xl text-wordy-700 mb-1">
            🔒 Close Matches
          </h2>
          <p className="text-sm text-wordy-600 mb-3">
            Close old or stuck matches. They'll show up in lobby history as
            "🛑 Closed by admin" with no winner.
          </p>
          {loading ? (
            <p className="text-sm text-wordy-500 italic">Loading…</p>
          ) : matches.length === 0 ? (
            <p className="text-sm text-wordy-500 italic">No open matches to close.</p>
          ) : (
            <ul className="space-y-2">
              {matches.map(m => {
                const isPrompting = reasonFor === m.id
                return (
                  <li
                    key={m.id}
                    className="rounded-xl px-3 py-2.5 bg-white border border-wordy-100 dark:bg-[#1f1240] dark:border-[#2d1b55]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm text-wordy-700 dark:text-wordy-100 truncate">
                          {m.creator_name ?? '?'} vs {m.opponent_name ?? '?'}
                        </div>
                        <div className="text-xs text-wordy-500 dark:text-wordy-300">
                          {m.format === 'best_of_3' ? 'Best of 3' : 'Single'} · {m.status} · {new Date(m.last_activity_at).toLocaleDateString()}
                        </div>
                      </div>
                      {!isPrompting && (
                        <button
                          type="button"
                          onClick={() => startClose(m.id)}
                          disabled={closingId === m.id}
                          className="shrink-0 text-xs font-bold text-rose-600 dark:text-rose-300 hover:underline disabled:opacity-50"
                        >
                          {closingId === m.id ? '…' : '✕ Close'}
                        </button>
                      )}
                    </div>
                    {isPrompting && (
                      <div className="mt-2 space-y-2">
                        <input
                          type="text"
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                          placeholder="Reason for closing (required)"
                          autoFocus
                          maxLength={200}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmClose(m.id)
                            if (e.key === 'Escape') cancelClose()
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-wordy-200 dark:border-[#2d1b55] dark:bg-[#1a0e30] text-xs text-wordy-700 dark:text-wordy-100 focus:border-wordy-400 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelClose}
                            disabled={closingId === m.id}
                            className="text-xs font-bold text-wordy-500 dark:text-wordy-300 hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmClose(m.id)}
                            disabled={closingId === m.id || !reasonText.trim()}
                            className="text-xs px-3 py-1 rounded-lg font-bold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50"
                          >
                            {closingId === m.id ? '…' : 'Confirm Close'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
