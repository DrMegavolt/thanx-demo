export type RedemptionAttempt = {
  userId: string
  rewardId: number
  key: string
}
export const ATTEMPT_STORAGE_KEY = 'rewards.pending-redemption.v1'

// sessionStorage survives reloads in this tab, including a lost POST response.
// It must be written successfully before any request can spend points.
export function loadAttempt(): RedemptionAttempt | null {
  const raw = sessionStorage.getItem(ATTEMPT_STORAGE_KEY)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (
    !value ||
    typeof value !== 'object' ||
    !('userId' in value) ||
    !('rewardId' in value) ||
    !('key' in value) ||
    typeof value.userId !== 'string' ||
    !/^[1-9]\d*$/.test(value.userId) ||
    !Number.isSafeInteger(value.rewardId) ||
    (value.rewardId as number) <= 0 ||
    typeof value.key !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value.key,
    )
  ) {
    throw new Error(
      'Unable to read the saved redemption. Check your history before discarding the saved request.',
    )
  }
  return value as RedemptionAttempt
}

export function saveAttempt(attempt: RedemptionAttempt) {
  sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt))
}

export function clearAttempt() {
  sessionStorage.removeItem(ATTEMPT_STORAGE_KEY)
}
