// ────────────────────────────────────────────────────────────
//  CompletedMatchBanner — banner list of the user's last 10
//  completed matches. Mirrors the wordy/rungles pattern: gradient
//  row with W/L emoji + score, "View Game" link to the final board.
// ────────────────────────────────────────────────────────────

export default function CompletedMatchBanner({ matches, onView }) {
  if (!matches || matches.length === 0) return null

  return matches.map((m) => (
    <BannerRow key={m.id} match={m} onView={onView} />
  ))
}

function BannerRow({ match, onView }) {
  const opponentName = match.opponent?.username ?? 'them'
  const headline = match.closed_by_admin
    ? '🛑 Match closed by admin'
    : match.winner_id
      ? (match.youWon ? '🏆 You won!' : `🌙 ${opponentName} won`)
      : "🤝 It's a tie!"
  const subtext = `You ${match.yourScore ?? 0} · ${opponentName} ${match.theirScore ?? 0}`

  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-gradient-to-r from-wordy-100 to-pink-50 border border-wordy-200 dark:from-wordy-900/40 dark:to-purple-900/30 dark:border-wordy-700">
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-wordy-700 dark:text-wordy-100 truncate">
          {headline}
        </div>
        <div className="text-xs text-wordy-500 dark:text-wordy-300 truncate">
          {subtext}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onView(match)}
        className="shrink-0 text-xs font-bold text-wordy-700 dark:text-wordy-200 underline hover:no-underline"
      >
        View Game
      </button>
    </div>
  )
}
