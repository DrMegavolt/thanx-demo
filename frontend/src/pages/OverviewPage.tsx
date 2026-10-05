import type { Ref } from 'react'
import type { Redemption, Reward } from '../api'
import { date, points } from '../format'
import { Link } from '../components/Link'
import { RewardArt } from '../components/RewardArt'
import { RewardCard } from '../components/RewardCard'

type OverviewPageProps = {
  balance: number
  rewards: Reward[]
  history: Redemption[]
  headingRef: Ref<HTMLHeadingElement>
}

export function OverviewPage({
  balance,
  rewards,
  history,
  headingRef,
}: OverviewPageProps) {
  const latestRedemption = history[0]
  const affordableRewards = rewards
    .filter((reward) => reward.points_cost <= balance)
    .slice(0, 3)

  return (
    <>
      <div className="page-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          A little thank you, on us.
        </h1>
        <p>Your points, ready for something good.</p>
      </div>
      <div className="overview-grid">
        <section className="balance-card">
          <p>Available points</p>
          <strong>{points(balance)}</strong>
          <p>Choose a reward to redeem your points.</p>
          <Link to="rewards" className="button peach">
            Explore rewards <span aria-hidden="true">→</span>
          </Link>
        </section>
        <section className="panel latest">
          <h2>Your latest redemption</h2>
          {latestRedemption ? (
            <div className="latest-row">
              <RewardArt name={latestRedemption.reward_name} small />
              <div>
                <h3>{latestRedemption.reward_name}</h3>
                <p>{points(latestRedemption.points_spent)} points</p>
                <time dateTime={latestRedemption.created_at}>
                  {date(latestRedemption.created_at)}
                </time>
              </div>
            </div>
          ) : (
            <p className="empty-copy">
              Your first treat is waiting. Redeem a reward to start your
              history.
            </p>
          )}
          <Link to="history" className="text-link">
            View history <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
      <section className="reach">
        <h2>Within reach</h2>
        <div className="reward-grid">
          {affordableRewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              balance={balance}
              overview
            />
          ))}
        </div>
        {!affordableRewards.length && (
          <div className="panel empty-copy">
            {rewards.length
              ? 'Keep collecting points for your next treat.'
              : 'New rewards will appear here when they’re available.'}{' '}
            <Link to="rewards">Browse rewards →</Link>
          </div>
        )}
      </section>
    </>
  )
}
