export type Balance = { user_id: number; name: string; points_balance: number }
export type Reward = { id: number; name: string; description: string | null; points_cost: number }
export type Redemption = { id: number; reward_id: number; reward_name: string; points_spent: number; created_at: string }
export type RedemptionResult = { redemption: Redemption; points_balance: number }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export async function request<T>(path: string, userId: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  headers.set('x-user', userId)
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: Object.fromEntries(headers),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code ?? 'unexpected_response',
      body?.error?.message ?? `The rewards service returned an error (${response.status}). Please try again.`)
  }
  if (body === null) throw new ApiError(500, 'unexpected_response', 'The rewards service returned an unreadable response.')
  return body as T
}
