import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { BackgroundFetchMessage } from '~/utils/background_fetch'

import background from '../background'
import { handleFetch } from '../background'

describe('background', () => {
  it('exports a background definition', () => {
    expect(background).toBeDefined()
  })
})

describe('handleFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns status, headers, and body on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"data":null}', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        })
      )
    )

    const message: BackgroundFetchMessage = {
      type: 'fetch',
      url: 'https://example.com/graphql',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"query":"{ __typename }"}',
      },
    }

    const result = await handleFetch(message)

    expect(result).toEqual({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"data":null}',
    })
    expect(fetch).toHaveBeenCalledWith('https://example.com/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"query":"{ __typename }"}',
    })
  })

  it('returns error message when fetch throws an Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const message: BackgroundFetchMessage = {
      type: 'fetch',
      url: 'https://example.com/graphql',
      init: {},
    }

    const result = await handleFetch(message)

    expect(result).toEqual({ error: 'Network failure' })
  })

  it('returns generic error message when fetch throws a non-Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('something went wrong'))

    const message: BackgroundFetchMessage = {
      type: 'fetch',
      url: 'https://example.com/graphql',
      init: {},
    }

    const result = await handleFetch(message)

    expect(result).toEqual({ error: 'Unknown fetch error' })
  })

  it('passes through all response headers', async () => {
    const responseHeaders = new Headers()
    responseHeaders.set('x-request-id', 'abc-123')
    responseHeaders.set('cache-control', 'no-store')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          statusText: 'OK',
          headers: responseHeaders,
        })
      )
    )

    const message: BackgroundFetchMessage = {
      type: 'fetch',
      url: 'https://example.com/graphql',
      init: { method: 'GET' },
    }

    const result = await handleFetch(message)

    expect(result).not.toHaveProperty('error')
    expect(result).toHaveProperty('headers.x-request-id', 'abc-123')
    expect(result).toHaveProperty('headers.cache-control', 'no-store')
  })
})
