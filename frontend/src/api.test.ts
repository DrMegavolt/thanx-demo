import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './api'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('request', () => {
  it('sends the demo identity and accept header, preserving the abort signal', async () => {
    const balance = { user_id: 2, name: 'Ruby', points_balance: 1250 }
    fetchMock.mockResolvedValue(Response.json(balance))
    const controller = new AbortController()

    await expect(
      request('/balance', '2', { signal: controller.signal }),
    ).resolves.toEqual(balance)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/balance')
    expect(options?.signal).toBe(controller.signal)
    expect(Object.fromEntries(new Headers(options?.headers))).toEqual({
      accept: 'application/json',
      'x-user': '2',
    })
  })

  it('sends a JSON redemption body with its content type', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ points_balance: 750 }, { status: 201 }),
    )
    const body = JSON.stringify({ reward_id: 7 })

    await request('/redemptions', '1', { method: 'POST', body })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/redemptions')
    expect(options).toMatchObject({ method: 'POST', body })
    expect(Object.fromEntries(new Headers(options?.headers))).toEqual({
      accept: 'application/json',
      'x-user': '1',
      'content-type': 'application/json',
    })
  })

  it('preserves a caller-supplied idempotency header with Headers or tuple input', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ points_balance: 750 }, { status: 201 }),
    )
    const key = crypto.randomUUID()
    for (const headers of [
      new Headers({ 'Idempotency-Key': key }),
      [['Idempotency-Key', key]] as [string, string][],
    ]) {
      await request('/redemptions', '2', {
        method: 'POST',
        body: '{"reward_id":1}',
        headers,
      })
      const sent = new Headers(fetchMock.mock.lastCall?.[1]?.headers)
      expect(sent.get('Idempotency-Key')).toBe(key)
      expect(sent.get('x-user')).toBe('2')
      expect(sent.get('Content-Type')).toBe('application/json')
    }
  })

  it('preserves the server error status, code, and message', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: { code: 'insufficient_points', message: 'Not enough points.' },
        },
        { status: 422 },
      ),
    )

    const error = await request('/redemptions', '1').catch(
      (value: unknown) => value,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      code: 'insufficient_points',
      message: 'Not enough points.',
    })
  })

  it.each(['<html>Bad gateway</html>', '{}'])(
    'handles an error without the API error envelope: %s',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 502 }))

      await expect(request('/balance', '1')).rejects.toMatchObject({
        status: 502,
        code: 'unexpected_response',
        message:
          'The rewards service returned an error (502). Please try again.',
      })
    },
  )

  it.each(['invalid JSON', 'null', ''])(
    'rejects unreadable successful responses: %s',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 200 }))

      await expect(request('/balance', '1')).rejects.toMatchObject({
        status: 500,
        code: 'unexpected_response',
        message: 'The rewards service returned an unreadable response.',
      })
    },
  )

  it.each([
    new TypeError('Failed to fetch'),
    new DOMException('Aborted', 'AbortError'),
  ])('propagates transport failures without retrying: %s', async (error) => {
    fetchMock.mockRejectedValue(error)

    await expect(
      request('/redemptions', '1', { method: 'POST', body: '{"reward_id":1}' }),
    ).rejects.toBe(error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
