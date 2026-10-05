import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Balance, Redemption, Reward } from './api'
import { ATTEMPT_STORAGE_KEY, loadAttempt } from './redemptionAttempt'

const coffee: Reward = { id: 1, name: 'Free coffee', description: 'Any regular coffee.', points_cost: 250 }
const lunch: Reward = { id: 2, name: 'Lunch for two', description: null, points_cost: 1500 }
const oldRedemption: Redemption = { id: 10, reward_id: 1, reward_name: 'Original coffee name', points_spent: 200, created_at: '2026-10-01T12:00:00Z' }
const newRedemption: Redemption = { id: 11, reward_id: 1, reward_name: 'Free coffee', points_spent: 250, created_at: '2026-10-04T12:00:00Z' }
const fetchMock = vi.fn<typeof fetch>()
let balance: Balance
let rewards: Reward[]
let history: Redemption[]
let post: () => Promise<Response>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function posts() {
  return fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')
}

async function ready(route = '/overview') {
  window.history.replaceState(null, '', `/#${route}`)
  const view = render(<App />)
  await waitFor(() => expect(screen.queryByText('Loading your rewards…')).not.toBeInTheDocument())
  return view
}

beforeEach(() => {
  balance = { user_id: 1, name: 'Alex Morgan', points_balance: 1000 }
  rewards = [coffee, lunch]
  history = [oldRedemption]
  post = async () => {
    balance = { ...balance, points_balance: 750 }
    history = [newRedemption, ...history]
    return Response.json({ redemption: newRedemption, points_balance: 750 }, { status: 201 })
  }
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/api/redemptions' && options?.method === 'POST') return post()
    if (url === '/api/balance') return Response.json(balance)
    if (url === '/api/rewards') return Response.json(rewards)
    if (url === '/api/redemptions') return Response.json(history)
    throw new Error(`Unexpected request: ${String(url)}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

describe('rewards screens', () => {
  it('loads the balance and latest historical snapshot, showing only affordable rewards on overview', async () => {
    await ready()

    expect(screen.getByRole('heading', { name: 'A little thank you, on us.' })).toBeInTheDocument()
    expect(screen.getByText((1000).toLocaleString())).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Original coffee name' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: coffee.name })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: lunch.name })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (const [, options] of fetchMock.mock.calls) {
      expect(Object.fromEntries(new Headers(options?.headers))).toEqual({ accept: 'application/json', 'x-user': '1' })
    }
  })

  it('navigates from catalog to confirmation and back without charging', async () => {
    const user = userEvent.setup()
    await ready()
    await user.click(screen.getByRole('link', { name: 'Rewards' }))
    expect(await screen.findByRole('heading', { name: 'Find your next treat.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Need 500 more points' })).toBeDisabled()
    await user.click(screen.getByRole('link', { name: 'Redeem' }))
    expect(await screen.findByRole('heading', { name: 'Confirm redemption' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Cancel' }))
    expect(await screen.findByRole('heading', { name: 'Find your next treat.' })).toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  it('shows history snapshots even when the current catalog has a different name and price', async () => {
    await ready('/history')
    const row = screen.getByRole('row', { name: /Original coffee name/ })
    expect(within(row).getByText('200')).toBeInTheDocument()
    expect(within(row).queryByText(coffee.name)).not.toBeInTheDocument()
    expect(row.querySelector('time')).toHaveAttribute('datetime', oldRedemption.created_at)
    expect(screen.getByText(/Showing all 1 redemption · newest first/)).toBeInTheDocument()
  })

  it('blocks unaffordable direct links without making a POST', async () => {
    const user = userEvent.setup()
    await ready('/rewards/2')
    expect(screen.getByText('You need 500 more points for this reward.')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: `Confirm · ${(1500).toLocaleString()} points` })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(posts()).toHaveLength(0)
  })

  it('handles a missing or inactive reward direct link', async () => {
    await ready('/rewards/999')
    expect(screen.getByRole('heading', { name: 'Reward unavailable.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Confirm/ })).not.toBeInTheDocument()
  })

  it('shows empty overview, catalog, and history states', async () => {
    rewards = []; history = []
    const user = userEvent.setup()
    await ready()
    expect(screen.getByText(/Your first treat is waiting/)).toBeInTheDocument()
    expect(screen.getByText(/New rewards will appear here/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Rewards' }))
    expect(await screen.findByText(/No rewards are available right now/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'History' }))
    expect(await screen.findByText(/No redemptions yet/)).toBeInTheDocument()
  })

  it('encourages a zero-balance user to collect points', async () => {
    balance.points_balance = 0
    await ready()
    expect(screen.getByText(/Keep collecting points/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /View reward/ })).not.toBeInTheDocument()
  })
})

describe('loading and demo identity', () => {
  it('shows loading, reports a failed read, and recovers on explicit retry', async () => {
    const user = userEvent.setup()
    const response = deferred<Response>()
    fetchMock.mockImplementationOnce(() => response.promise)
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your rewards…')
    await act(async () => response.reject(new TypeError('Offline')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect. Check that Rails is running and try again.')
    expect(screen.getByRole('heading', { name: 'Your rewards are a moment away.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'A little thank you, on us.' })).toBeInTheDocument()
  })

  it('switches demo identities and ignores stale responses for the previous user', async () => {
    const user = userEvent.setup()
    const staleBalance = deferred<Response>()
    fetchMock.mockImplementationOnce(() => staleBalance.promise)
    render(<App />)
    const oldSignal = fetchMock.mock.calls[0][1]?.signal
    await user.click(screen.getByText('Demo user'))
    expect(screen.getByText(/this is not authentication/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('User ID'))
    await user.type(screen.getByLabelText('User ID'), '2')
    balance = { user_id: 2, name: 'Ruby Jones', points_balance: 50 }
    history = []
    await user.click(screen.getByRole('button', { name: 'Select user' }))
    expect(await screen.findByText('Ruby Jones')).toBeInTheDocument()
    expect(oldSignal?.aborted).toBe(true)
    expect(fetchMock.mock.calls.slice(-3).every(([, options]) => new Headers(options?.headers).get('x-user') === '2')).toBe(true)
    await act(async () => staleBalance.resolve(Response.json({ user_id: 1, name: 'Stale Alex', points_balance: 9999 })))
    expect(screen.queryByText('Stale Alex')).not.toBeInTheDocument()
    expect(screen.getByText('Ruby Jones')).toBeInTheDocument()
    expect(screen.getByText(/Your first treat is waiting/)).toBeInTheDocument()
  })

  it('aborts outstanding reads when unmounted', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const { unmount } = render(<App />)
    const signals = fetchMock.mock.calls.map(([, options]) => options?.signal)
    unmount()
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal?.aborted)).toBe(true)
  })
})

describe('redemption', () => {
  it('submits only the reward ID once while pending, then refreshes balance and history', async () => {
    const user = userEvent.setup()
    const response = deferred<Response>()
    post = () => response.promise
    await ready('/rewards/1')
    const confirm = screen.getByRole('button', { name: 'Confirm · 250 points' })
    // Two synchronous clicks also exercise the ref guard before React rerenders.
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm) })
    expect(posts()).toHaveLength(1)
    const [url, options] = posts()[0]
    expect(url).toBe('/api/redemptions')
    expect(options).toMatchObject({ method: 'POST', body: '{"reward_id":1}' })
    const headers = new Headers(options?.headers)
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('x-user')).toBe('1')
    expect(headers.get('content-type')).toBe('application/json')
    expect(screen.getByRole('button', { name: 'Redeeming…' })).toBeDisabled()
    expect(loadAttempt()).toEqual({ userId: '1', rewardId: 1, key: new Headers(posts()[0][1]?.headers).get('Idempotency-Key') })
    expect(screen.queryByText('Free coffee is yours!')).not.toBeInTheDocument()
    await user.click(screen.getByText('Alex Morgan'))
    expect(screen.getByLabelText('User ID')).toBeDisabled()
    balance.points_balance = 750; history = [newRedemption, oldRedemption]
    await act(async () => response.resolve(Response.json({ redemption: newRedemption, points_balance: 750 }, { status: 201 })))
    expect(await screen.findByText('Free coffee is yours!')).toBeInTheDocument()
    expect(screen.getByText('250 points redeemed. Balance after this redemption: 750 points.')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(7))
    await user.click(screen.getByRole('link', { name: 'View redemption history →' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Free coffee')
    expect(screen.getByText('750')).toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  it('displays insufficient-points errors and refreshes the stale balance', async () => {
    const user = userEvent.setup()
    post = async () => {
      balance.points_balance = 100
      return Response.json({ error: { code: 'insufficient_points', message: 'You do not have enough points to redeem this reward.' } }, { status: 422 })
    }
    await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have enough points')
    expect(await screen.findByText('You need 150 more points for this reward.')).toBeInTheDocument()
    expect(loadAttempt()).toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm · 250 points' })).toBeDisabled()
    expect(posts()).toHaveLength(1)
  })

  it('removes confirmation when the server reports the reward was deactivated', async () => {
    const user = userEvent.setup()
    post = async () => {
      rewards = []
      return Response.json({ error: { code: 'reward_inactive', message: 'This reward is inactive.' } }, { status: 422 })
    }
    await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(await screen.findByRole('heading', { name: 'Reward unavailable.' })).toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  it.each(['network', 'server', 'unreadable', 'malformed'] as const)('preserves the key across refresh after an ambiguous %s failure', async failure => {
    const user = userEvent.setup()
    post = async () => {
      balance.points_balance = 0; history = [newRedemption, oldRedemption]
      if (failure === 'network') throw new TypeError('Connection lost')
      if (failure === 'unreadable') return new Response('invalid JSON', { status: 201 })
      if (failure === 'malformed') return Response.json({}, { status: 201 })
      return Response.json({ error: { code: 'internal_error', message: 'Internal error.' } }, { status: 500 })
    }
    const view = await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t confirm your redemption.')
    const saved = loadAttempt()
    expect(saved).toMatchObject({ userId: '1', rewardId: 1, key: expect.any(String) })
    const key = new Headers(posts()[0][1]?.headers).get('Idempotency-Key')
    expect(saved?.key).toBe(key)
    // A read refresh cannot establish which request created a history entry.
    await user.click(screen.getByRole('button', { name: 'Refresh balance and history' }))
    await waitFor(() => expect(screen.queryByText('Refreshing your rewards…')).not.toBeInTheDocument())
    expect(loadAttempt()).toEqual(saved)
    view.unmount()
    rewards = [] // Retry must work even when the catalog no longer contains it.
    await ready('/overview')
    expect(screen.getByRole('button', { name: 'Select user' })).toBeDisabled()
    post = async () => Response.json({ redemption: newRedemption, points_balance: 750 }, { status: 201 })
    await user.click(screen.getByRole('button', { name: 'Retry saved redemption' }))
    expect(await screen.findByText('Free coffee is yours!')).toBeInTheDocument()
    expect(posts()).toHaveLength(2)
    expect(new Headers(posts()[1][1]?.headers).get('Idempotency-Key')).toBe(key)
    expect(posts()[1][1]?.body).toBe(posts()[0][1]?.body)
    expect(sessionStorage.getItem(ATTEMPT_STORAGE_KEY)).toBeNull()
  })

  it('retries a busy response with the same key', async () => {
    const user = userEvent.setup()
    post = async () => Response.json({ error: { code: 'service_unavailable', message: 'The database is busy.' } }, { status: 503 })
    await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    await screen.findByRole('alert')
    const key = loadAttempt()?.key
    await user.click(screen.getByRole('button', { name: 'Retry saved redemption' }))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(new Headers(posts()[1][1]?.headers).get('Idempotency-Key')).toBe(key)
    expect(loadAttempt()?.key).toBe(key)
  })

  it('restores an attempt when the page refreshes while the POST is still pending', async () => {
    const user = userEvent.setup()
    post = () => new Promise<Response>(() => {})
    const firstPage = await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(screen.getByRole('button', { name: 'Redeeming…' })).toBeDisabled()
    const original = loadAttempt()
    firstPage.unmount()
    post = async () => Response.json({ redemption: newRedemption, points_balance: 750 }, { status: 201 })
    await ready('/overview')
    expect(loadAttempt()).toEqual(original)
    await user.click(screen.getByRole('button', { name: 'Retry saved redemption' }))
    expect(await screen.findByText('Free coffee is yours!')).toBeInTheDocument()
    expect(posts()).toHaveLength(2)
    expect(new Headers(posts()[1][1]?.headers).get('Idempotency-Key')).toBe(original?.key)
    expect(loadAttempt()).toBeNull()
  })

  it('keeps a conflicting key and blocks starting a replacement purchase', async () => {
    const user = userEvent.setup()
    post = async () => Response.json({ error: { code: 'idempotency_conflict', message: 'Already used.' } }, { status: 409 })
    await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Its key cannot safely be replaced.')
    expect(loadAttempt()?.key).toBe(new Headers(posts()[0][1]?.headers).get('Idempotency-Key'))
    expect(screen.getByRole('button', { name: 'Confirm · 250 points' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select user' })).toBeDisabled()
  })

  it('uses a new key for a genuinely new redemption', async () => {
    const user = userEvent.setup()
    await ready('/rewards/1')
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    await screen.findByText('Free coffee is yours!')
    const firstKey = new Headers(posts()[0][1]?.headers).get('Idempotency-Key')
    await user.click(screen.getByRole('link', { name: '← Back to rewards' }))
    await user.click(await screen.findByRole('link', { name: 'Redeem' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm · 250 points' }))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(new Headers(posts()[1][1]?.headers).get('Idempotency-Key')).not.toBe(firstKey)
  })

  it('restores the original identity with the saved attempt after reload', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify({ userId: '2', rewardId: 1, key: crypto.randomUUID() }))
    await ready('/overview')
    expect(fetchMock.mock.calls.every(([, options]) => new Headers(options?.headers).get('x-user') === '2')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Retry saved redemption' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(new Headers(posts()[0][1]?.headers).get('x-user')).toBe('2')
  })

  it('does not send a POST when the attempt cannot be persisted', async () => {
    const user = userEvent.setup()
    await ready('/rewards/1')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded') })
    await user.click(screen.getByRole('button', { name: 'Confirm · 250 points' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save your redemption request.')
    expect(posts()).toHaveLength(0)
  })
})
