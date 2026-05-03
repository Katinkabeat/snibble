import CompletedMatchBanner from './CompletedMatchBanner.jsx'
import { SQCompletedGamesCard } from '../../../rae-side-quest/packages/sq-ui/index.js'

export default function CompletedMatchesSection({ matches, onView }) {
  return (
    <SQCompletedGamesCard title="🏁 Completed Matches">
      {matches.length > 0 ? (
        <CompletedMatchBanner matches={matches} onView={onView} />
      ) : null}
    </SQCompletedGamesCard>
  )
}
