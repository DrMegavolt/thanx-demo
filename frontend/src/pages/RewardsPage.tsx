import type { Ref } from 'react'
import type { Reward } from '../api'
import { points } from '../format'
import { RewardCard } from '../components/RewardCard'

type RewardsPageProps = {
  balance: number
  rewards: Reward[]
  headingRef: Ref<HTMLHeadingElement>
}

export function RewardsPage({
  balance,
  rewards,
  headingRef,
}: RewardsPageProps) {
  return (
    <>
      <div className="heading-row">
        <div className="page-heading">
          <h1 ref={headingRef} tabIndex={-1}>
            Find your next treat.
          </h1>
          <p>Choose a reward and make your points count.</p>
        </div>
        <div className="points-badge">
          <span aria-hidden="true">◎</span>
          <strong>{points(balance)}</strong> points available
        </div>
      </div>
      <div className="reward-grid">
        {rewards.map((reward) => (
          <RewardCard key={reward.id} reward={reward} balance={balance} />
        ))}
      </div>
      {!rewards.length && (
        <div className="panel empty-copy">
          No rewards are available right now. Check back soon.
        </div>
      )}
    </>
  )
}
