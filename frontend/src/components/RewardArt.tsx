import { useState } from 'react'

export function RewardArt({
  rewardId,
  small = false,
}: {
  rewardId: number
  small?: boolean
}) {
  const [failedRewardId, setFailedRewardId] = useState<number | null>(null)
  return (
    <div aria-hidden="true" className={`reward-art ${small ? 'small' : ''}`}>
      {failedRewardId === rewardId ? (
        <span>✧</span>
      ) : (
        <img
          src={`/reward_${rewardId}.png`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedRewardId(rewardId)}
        />
      )}
    </div>
  )
}
