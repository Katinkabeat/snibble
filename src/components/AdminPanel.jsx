// Snibble admin panel — Close Matches view only. Admin permissions
// live in the shared `admins` table (managed from Wordy's panel).

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import SnibbleHeader from './SnibbleHeader.jsx'

export default function AdminPanel({ user, onBack }) {
  const [matches, setMatches]     = useState([])
  const [closingId, setClosingId] = useState(null)
  const [loading, setLoading]     = useState(true)

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

  async function closeMatch(matchId) {
    setClosingId(matchId)
    try {
      const { error } = await supabase.rpc('sn_admin_close_match', { p_match_id: matchId })
      if (error) throw error
      toast.success('Match closed.')
      setMatches(prev => prev.filter(m => m.id !== matchId))
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
              {matches.map(m => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white border border-wordy-100 dark:bg-[#1f1240] dark:border-[#2d1b55]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm text-wordy-700 dark:text-wordy-100 truncate">
                      {m.creator_name ?? '?'} vs {m.opponent_name ?? '?'}
                    </div>
                    <div className="text-xs text-wordy-500 dark:text-wordy-300">
                      {m.format === 'best_of_3' ? 'Best of 3' : 'Single'} · {m.status} · {new Date(m.last_activity_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeMatch(m.id)}
                    disabled={closingId === m.id}
                    className="shrink-0 text-xs font-bold text-rose-600 dark:text-rose-300 hover:underline disabled:opacity-50"
                  >
                    {closingId === m.id ? '…' : '✕ Close'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
