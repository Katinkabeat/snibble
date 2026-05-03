import CompletedMatchBanner from './CompletedMatchBanner.jsx'
import { SQCompletedGamesCard } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function CompletedMatchesSection({ matches, userId, onView, onDismissed }) {
  return (
    <SQCompletedGamesCard title="🏁 Completed Matches">
      {matches.length > 0 ? (
        <CompletedMatchBanner
          matches={matches}
          userId={userId}
          onView={onView}
          onDismissed={onDismissed}
        />
      ) : null}
    </SQCompletedGamesCard>
  )
}
