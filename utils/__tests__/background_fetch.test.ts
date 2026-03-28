import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import type { BackgroundFetchResponse } from '../background_fetch'

let mockResponseValue: BackgroundFetchResponse | undefined

describe('backgroundFetch', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.resetModules()
    mockResponseValue = undefined

    fakeBrowser.runtime.onMessage.addListener((_message: unknown, _sender: unknown) => {
      return Promise.resolve(mockResponseValue)
    })
  })

  async function importBackgroundFetch() {
    const { backgroundFetch } = await import('../background_fetch')
    return backgroundFetch
  }

  it('sends a fetch message and returns a valid Response', async () => {
    mockResponseValue = {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"data":{"hello":"world"}}',
    }

    const backgroundFetch = await importBackgroundFetch()
    const response = await backgroundFetch('https://example.com/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ hello }' }),
    })

    expect(response.status).toBe(200)
    expect(response.statusText).toBe('OK')
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(await response.json()).toEqual({ data: { hello: 'world' } })
  })

  it('preserves error status and headers', async () => {
    mockResponseValue = {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'x-custom': 'value' },
      body: '{"errors":[]}',
    }

    const backgroundFetch = await importBackgroundFetch()
    const response = await backgroundFetch('https://example.com/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    expect(response.status).toBe(400)
    expect(response.statusText).toBe('Bad Request')
    expect(response.headers.get('x-custom')).toBe('value')
  })

  it('throws when background script returns no response', async () => {
    mockResponseValue = undefined

    const backgroundFetch = await importBackgroundFetch()
    await expect(
      backgroundFetch('https://example.com/graphql', {
        method: 'POST',
        body: '{}',
      })
    ).rejects.toThrow('Failed to fetch (no response from background script)')
  })

  it('relays fetch errors from the background script', async () => {
    mockResponseValue = {
      error: 'net::ERR_CONNECTION_REFUSED',
    } as unknown as BackgroundFetchResponse

    const backgroundFetch = await importBackgroundFetch()
    await expect(
      backgroundFetch('https://example.com/graphql', {
        method: 'POST',
        body: '{}',
      })
    ).rejects.toThrow('net::ERR_CONNECTION_REFUSED')
  })

  it('handles GET requests without a body', async () => {
    mockResponseValue = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"data":{}}',
    }

    const backgroundFetch = await importBackgroundFetch()
    const response = await backgroundFetch('https://example.com/graphql?query={hello}')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: {} })
  })
})
