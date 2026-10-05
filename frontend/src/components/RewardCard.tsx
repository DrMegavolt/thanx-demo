import type { Reward } from '../api'
import { points } from '../format'
import { Link } from './Link'
import { RewardArt } from './RewardArt'

type RewardCardProps = { reward: Reward; balance: number; overview?: boolean }

export function RewardCard({
  reward,
  balance,
  overview = false,
}: RewardCardProps) {
  const shortfall = reward.points_cost - balance
  return (
    <article className="reward-card">
      <RewardArt name={reward.name} />
      <div className="reward-content">
        <div className="reward-title">
          <h3>{reward.name}</h3>
          <p>
            <strong>{points(reward.points_cost)}</strong> points
          </p>
        </div>
        {!overview && (
          <p className="description">
            {reward.description || 'A little something good, on us.'}
          </p>
        )}
        {shortfall > 0 ? (
          <button className="button" disabled>
            Need {points(shortfall)} more points
          </button>
        ) : (
          <Link
            className={`button ${overview ? 'outline' : 'primary'}`}
            to={`rewards/${reward.id}`}
          >
            {overview ? 'View reward' : 'Redeem'}
            {overview && <span aria-hidden="true"> →</span>}
          </Link>
        )}
      </div>
    </article>
  )
}
