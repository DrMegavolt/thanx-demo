import { describe, expect, it, vi } from 'vitest'
import {
  ATTEMPT_STORAGE_KEY,
  clearAttempt,
  loadAttempt,
  saveAttempt,
} from './redemptionAttempt'

const attempt = {
  userId: '2',
  rewardId: 7,
  key: '550e8400-e29b-41d4-a716-446655440000',
}

describe('saved redemption request', () => {
  it('round-trips the request identity and removes only its own storage entry', () => {
    expect(loadAttempt()).toBeNull()
    sessionStorage.setItem('unrelated', 'keep')
    saveAttempt(attempt)
    expect(loadAttempt()).toEqual(attempt)
    clearAttempt()
    expect(loadAttempt()).toBeNull()
    expect(sessionStorage.getItem('unrelated')).toBe('keep')
  })

  it.each([
    null,
    [],
    {},
    { ...attempt, userId: '0' },
    { ...attempt, userId: 2 },
    { ...attempt, rewardId: 0 },
    { ...attempt, rewardId: 1.5 },
    { ...attempt, rewardId: Number.MAX_SAFE_INTEGER + 1 },
    { ...attempt, key: 'not-a-uuid' },
    { ...attempt, key: 123 },
  ])('rejects a corrupt saved request: %j', (value) => {
    sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(value))
    expect(() => loadAttempt()).toThrow('Unable to read the saved redemption.')
  })

  it('does not silently discard malformed JSON', () => {
    sessionStorage.setItem(ATTEMPT_STORAGE_KEY, '{')
    expect(() => loadAttempt()).toThrow(SyntaxError)
    expect(sessionStorage.getItem(ATTEMPT_STORAGE_KEY)).toBe('{')
  })

  it.each(['getItem', 'setItem', 'removeItem'] as const)(
    'propagates storage failure from %s',
    (method) => {
      const error = new DOMException('Storage unavailable', 'SecurityError')
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw error
      })
      const action =
        method === 'getItem'
          ? loadAttempt
          : method === 'setItem'
            ? () => saveAttempt(attempt)
            : clearAttempt
      expect(action).toThrow(error)
    },
  )
})
