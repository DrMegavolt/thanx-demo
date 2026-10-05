import { useCallback, useReducer, useRef } from 'react'
import {
  ApiError,
  errorMessage,
  request,
  type RedemptionResult,
  type Reward,
} from '../api'
import {
  clearAttempt,
  loadAttempt,
  saveAttempt,
  type RedemptionAttempt,
} from '../redemptionAttempt'

export type RedemptionState = {
  attempt: RedemptionAttempt | null
  pending: boolean
  storageError: string
  redeemError: string
  success: RedemptionResult | null
  // Completed or conclusively rejected writes trigger fresh API reads.
  revision: number
}

type RedemptionAction =
  | { type: 'restore'; attempt: RedemptionAttempt }
  | { type: 'start' }
  | { type: 'success'; result: RedemptionResult }
  | { type: 'reject'; error: string; storageError: string }
  | { type: 'uncertain'; error: string }
  | { type: 'storage-error'; error: string }
  | { type: 'finish' }
  | { type: 'navigate'; rewardId?: number }
  | { type: 'reset' }
  | { type: 'discard' }

function initialState(): RedemptionState {
  const state: RedemptionState = {
    attempt: null,
    pending: false,
    storageError: '',
    redeemError: '',
    success: null,
    revision: 0,
  }

  try {
    return { ...state, attempt: loadAttempt() }
  } catch {
    return {
      ...state,
      storageError:
        'Unable to read the saved redemption. Check your history before discarding the saved request.',
    }
  }
}

export function redemptionReducer(
  state: RedemptionState,
  action: RedemptionAction,
): RedemptionState {
  switch (action.type) {
    case 'restore':
      return { ...state, attempt: action.attempt }
    case 'start':
      return { ...state, pending: true, redeemError: '' }
    case 'success':
      return {
        ...state,
        attempt: null,
        storageError: '',
        success: action.result,
        revision: state.revision + 1,
      }
    case 'reject':
      return {
        ...state,
        attempt: action.storageError ? state.attempt : null,
        storageError: action.storageError || state.storageError,
        redeemError: action.error,
        revision: state.revision + 1,
      }
    case 'uncertain':
      return { ...state, redeemError: action.error }
    case 'storage-error':
      return { ...state, storageError: action.error }
    case 'finish':
      return { ...state, pending: false }
    case 'navigate':
      return {
        ...state,
        success:
          state.success?.redemption.reward_id === action.rewardId
            ? state.success
            : null,
        redeemError: '',
      }
    case 'discard':
      return {
        ...state,
        attempt: null,
        storageError: '',
        redeemError: '',
        success: null,
        revision: state.revision + 1,
      }
    case 'reset':
      return { ...state, success: null, redeemError: '' }
  }
}

function validateResult(result: RedemptionResult, rewardId: number) {
  if (
    !result.redemption ||
    result.redemption.reward_id !== rewardId ||
    !Number.isSafeInteger(result.redemption.id) ||
    result.redemption.id <= 0 ||
    !Number.isSafeInteger(result.points_balance) ||
    result.points_balance < 0 ||
    typeof result.redemption.reward_name !== 'string' ||
    !Number.isSafeInteger(result.redemption.points_spent) ||
    result.redemption.points_spent <= 0 ||
    typeof result.redemption.created_at !== 'string' ||
    !Number.isFinite(Date.parse(result.redemption.created_at))
  ) {
    throw new Error('Unreadable redemption result.')
  }
}

function isRejected(error: unknown): error is ApiError {
  // Only known API validation/domain errors conclusively reject this write.
  return (
    error instanceof ApiError &&
    error.status < 500 &&
    [
      'missing_user_header',
      'invalid_user_header',
      'user_not_found',
      'unsupported_media_type',
      'invalid_json',
      'invalid_request',
      'missing_idempotency_key',
      'invalid_idempotency_key',
      'reward_not_found',
      'reward_inactive',
      'insufficient_points',
    ].includes(error.code)
  )
}

export function useRedemption() {
  const [state, dispatch] = useReducer(
    redemptionReducer,
    undefined,
    initialState,
  )
  // The ref also blocks duplicate clicks before React renders pending state.
  const submitting = useRef(false)
  const uncertain = state.attempt !== null
  const identityLocked = state.pending || uncertain || !!state.storageError

  const navigate = useCallback((rewardId?: number) => {
    dispatch({ type: 'navigate', rewardId })
  }, [])

  function reset() {
    dispatch({ type: 'reset' })
  }

  async function submitAttempt(current: RedemptionAttempt) {
    if (submitting.current) return
    submitting.current = true
    dispatch({ type: 'start' })

    try {
      const result = await request<RedemptionResult>(
        '/redemptions',
        current.userId,
        {
          method: 'POST',
          body: JSON.stringify({ reward_id: current.rewardId }),
          headers: { 'Idempotency-Key': current.key },
        },
      )
      validateResult(result, current.rewardId)
      clearAttempt()
      // The replay balance is historical; revision refreshes the current balance.
      dispatch({ type: 'success', result })
      window.location.assign(`#/rewards/${current.rewardId}`)
    } catch (error) {
      if (isRejected(error)) {
        let storageError = ''
        try {
          clearAttempt()
        } catch {
          storageError =
            'Unable to clear the saved redemption. Allow site storage in your browser settings, then retry the saved request.'
        }
        dispatch({ type: 'reject', error: errorMessage(error), storageError })
      } else {
        dispatch({
          type: 'uncertain',
          error:
            error instanceof ApiError && error.code === 'idempotency_conflict'
              ? 'The saved request conflicts with another reward. Check your history before discarding the saved request.'
              : 'We couldn’t confirm your redemption. Retry the saved request to safely confirm its result.',
        })
      }
    } finally {
      submitting.current = false
      dispatch({ type: 'finish' })
    }
  }

  async function redeem(
    reward: Reward,
    userId: string,
  ): Promise<string | undefined> {
    if (submitting.current || identityLocked) return

    let current: RedemptionAttempt
    try {
      // Read again at the action boundary, so an existing saved attempt wins.
      const existing = loadAttempt()
      if (existing) {
        dispatch({ type: 'restore', attempt: existing })
        return existing.userId
      }
      current = { userId, rewardId: reward.id, key: crypto.randomUUID() }
      saveAttempt(current)
    } catch {
      dispatch({
        type: 'storage-error',
        error:
          'Unable to save your redemption request. Enable browser storage before redeeming.',
      })
      return
    }

    dispatch({ type: 'restore', attempt: current })
    await submitAttempt(current)
  }

  function discard() {
    if (submitting.current || state.pending) return
    try {
      clearAttempt()
      // Do not unlock if storage remains inaccessible or still has a request.
      if (loadAttempt()) throw new Error('Saved request remains.')
      dispatch({ type: 'discard' })
    } catch {
      dispatch({
        type: 'storage-error',
        error:
          'Unable to discard the saved request. Allow site storage in your browser settings, then try again.',
      })
    }
  }

  async function retry() {
    if (state.attempt) await submitAttempt(state.attempt)
  }

  return {
    ...state,
    uncertain,
    identityLocked,
    navigate,
    reset,
    redeem,
    retry,
    discard,
  }
}
