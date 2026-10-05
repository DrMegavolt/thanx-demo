import type { Ref } from 'react'
import type { RedemptionResult, Reward } from '../api'
import { points } from '../format'
import { Link } from '../components/Link'
import { RewardArt } from '../components/RewardArt'

type RedemptionPageProps = {
  balance: number
  reward?: Reward
  success: RedemptionResult | null
  pending: boolean
  uncertain: boolean
  disabled: boolean
  redeemError: string
  onRedeem: (reward: Reward) => void
  headingRef: Ref<HTMLHeadingElement>
}

export function RedemptionPage({
  balance,
  reward,
  success,
  pending,
  uncertain,
  disabled,
  redeemError,
  onRedeem,
  headingRef,
}: RedemptionPageProps) {
  let title = 'Reward unavailable.'
  if (success) {
    title = 'A little good, all yours.'
  } else if (reward) {
    title = /coffee/i.test(reward.name)
      ? 'Make it a coffee.'
      : 'Make it a little rewarding.'
  }

  return (
    <>
      <Link to="rewards" className="back-link">
        ← Back to rewards
      </Link>
      <div className="page-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
      </div>
      {success ? (
        <section className="panel success" role="status">
          <span className="success-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <h2>{success.redemption.reward_name} is yours!</h2>
            <p>
              {points(success.redemption.points_spent)} points redeemed. Balance
              after this redemption: {points(success.points_balance)} points.
            </p>
          </div>
          <Link className="text-link" to="history">
            View redemption history →
          </Link>
        </section>
      ) : reward ? (
        <div className="confirmation-grid">
          <section className="feature-reward">
            <RewardArt rewardId={reward.id} />
            <div>
              <h2>{reward.name}</h2>
              <p>{reward.description || 'A little something good, on us.'}</p>
            </div>
          </section>
          <section className="panel confirmation">
            <h2>Confirm redemption</h2>
            <dl>
              <div>
                <dt>Current balance</dt>
                <dd>{points(balance)} points</dd>
              </div>
              <div>
                <dt>Reward cost</dt>
                <dd>{points(reward.points_cost)} points</dd>
              </div>
              <div className="total">
                <dt>Balance after redemption</dt>
                <dd>
                  {points(Math.max(0, balance - reward.points_cost))} points
                </dd>
              </div>
            </dl>
            {balance < reward.points_cost && (
              <p role="status" className="shortfall">
                You need {points(reward.points_cost - balance)} more points for
                this reward.
              </p>
            )}
            {redeemError && !uncertain && (
              <p className="inline-error" role="alert">
                {redeemError}
              </p>
            )}
            <button
              className="button primary"
              onClick={() => onRedeem(reward)}
              disabled={disabled || balance < reward.points_cost}
            >
              {pending
                ? 'Redeeming…'
                : `Confirm · ${points(reward.points_cost)} points`}
            </button>
            <Link to="rewards" className="button outline">
              Cancel
            </Link>
            <p className="fine-print">Points are deducted when you confirm.</p>
          </section>
        </div>
      ) : (
        <div className="panel empty-copy">
          This reward is no longer available.{' '}
          <Link to="rewards">Choose another reward →</Link>
        </div>
      )}
    </>
  )
}
