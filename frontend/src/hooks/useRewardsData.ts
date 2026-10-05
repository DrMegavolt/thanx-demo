import { useCallback, useEffect, useState } from 'react'
import {
  errorMessage,
  request,
  type Balance,
  type Redemption,
  type Reward,
} from '../api'

export type RewardsData = {
  balance: Balance
  rewards: Reward[]
  history: Redemption[]
}

export function useRewardsData(
  initialUserId: string,
  redemptionRevision: number,
) {
  const [userId, setUserId] = useState(initialUserId)
  const [data, setData] = useState<RewardsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  function selectUser(nextUserId: string) {
    if (nextUserId === userId) return
    setData(null)
    setUserId(nextUserId)
  }

  useEffect(() => {
    const controller = new AbortController()
    // Identity changes and explicit refreshes start a new external request.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setLoadError('')

    Promise.all([
      request<Balance>('/balance', userId, { signal: controller.signal }),
      request<Reward[]>('/rewards', userId, { signal: controller.signal }),
      request<Redemption[]>('/redemptions', userId, {
        signal: controller.signal,
      }),
    ])
      .then(([balance, rewards, history]) => {
        if (controller.signal.aborted) return
        setData({ balance, rewards, history })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [userId, revision, redemptionRevision])

  return { userId, data, loading, loadError, refresh, selectUser }
}
