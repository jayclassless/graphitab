import { renderHook, act } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { HAREntry } from '../har'
import { useGraphQLRequests } from '../useGraphQLRequests'

type RequestListener = (entry: HAREntry) => void
type NavigatedListener = () => void

function makeChromeMock() {
  let capturedRequestListener: RequestListener | null = null
  const onRequestFinishedAddListener = vi.fn((fn: RequestListener) => {
    capturedRequestListener = fn
  })
  const onRequestFinishedRemoveListener = vi.fn((fn: RequestListener) => {
    if (capturedRequestListener === fn) capturedRequestListener = null
  })

  let capturedNavigatedListeners: NavigatedListener[] = []
  const onNavigatedAddListener = vi.fn((fn: NavigatedListener) => {
    capturedNavigatedListeners.push(fn)
  })
  const onNavigatedRemoveListener = vi.fn((fn: NavigatedListener) => {
    capturedNavigatedListeners = capturedNavigatedListeners.filter((l) => l !== fn)
  })

  const chrome = {
    devtools: {
      network: {
        onRequestFinished: {
          addListener: onRequestFinishedAddListener,
          removeListener: onRequestFinishedRemoveListener,
        },
        onNavigated: {
          addListener: onNavigatedAddListener,
          removeListener: onNavigatedRemoveListener,
        },
      },
    },
  }

  function fire(entry: HAREntry) {
    capturedRequestListener?.(entry)
  }

  function fireNavigated() {
    capturedNavigatedListeners.forEach((l) => l())
  }

  return {
    chrome,
    addListener: onRequestFinishedAddListener,
    removeListener: onRequestFinishedRemoveListener,
    onNavigatedAddListener,
    onNavigatedRemoveListener,
    fire,
    fireNavigated,
  }
}

function makeGraphQLEntry(
  requestOverrides: Partial<HAREntry['request']> = {},
  responseBody = '{"data":{"hero":{"name":"Luke"}}}',
  encoding = ''
): HAREntry {
  return {
    request: {
      method: 'POST',
      url: 'https://api.example.com/graphql',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      ...requestOverrides,
    },
    response: { status: 200, content: { size: 512 } },
    time: 123,
    getContent: (cb) => cb(responseBody, encoding),
  }
}

function makeNonGraphQLEntry(): HAREntry {
  return {
    request: {
      method: 'GET',
      url: 'https://api.example.com/rest',
      headers: [],
    },
    response: { status: 200, content: { size: 100 } },
    time: 50,
    getContent: (cb) => cb('', ''),
  }
}

describe('useGraphQLRequests', () => {
  let mock: ReturnType<typeof makeChromeMock>

  beforeEach(() => {
    mock = makeChromeMock()
    vi.stubGlobal('chrome', mock.chrome)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    expect(result.current.requests).toEqual([])
  })

  it('registers listener on mount', () => {
    renderHook(() => useGraphQLRequests(false))
    expect(mock.addListener).toHaveBeenCalledOnce()
  })

  it('removes same listener on unmount', () => {
    const { unmount } = renderHook(() => useGraphQLRequests(false))
    const registeredFn = mock.addListener.mock.calls[0][0]
    unmount()
    expect(mock.removeListener).toHaveBeenCalledWith(registeredFn)
  })

  it('adds a GraphQLRequest entry when a matching HAR entry fires', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.requests).toHaveLength(1)
    expect(result.current.requests[0]).toMatchObject({
      id: '1',
      operationName: 'GetHero',
      operationType: 'query',
      status: 200,
      size: 512,
      time: 123,
      url: 'https://api.example.com/graphql',
      query: 'query GetHero { hero { name } }',
      response: '{"data":{"hero":{"name":"Luke"}}}',
    })
  })

  it('stores variables when present in the request', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(
        makeGraphQLEntry({
          postData: {
            text: JSON.stringify({
              query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
              variables: { id: '1' },
            }),
          },
        })
      )
    })
    expect(result.current.requests[0]).toMatchObject({
      query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
      variables: '{\n  "id": "1"\n}',
    })
  })

  it('response is undefined when getContent returns empty string', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry({}, ''))
    })
    expect(result.current.requests[0].response).toBeUndefined()
  })

  it('ignores non-GraphQL entries', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeNonGraphQLEntry())
    })
    expect(result.current.requests).toHaveLength(0)
  })

  it('multiple entries accumulate in order', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
      mock.fire(
        makeGraphQLEntry({
          postData: {
            text: JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' }),
          },
        })
      )
    })
    expect(result.current.requests).toHaveLength(2)
    expect(result.current.requests[0]).toMatchObject({
      operationName: 'GetHero',
      operationType: 'query',
    })
    expect(result.current.requests[1]).toMatchObject({
      operationName: 'CreateUser',
      operationType: 'mutation',
    })
  })

  it('id increments monotonically across multiple entries', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
      mock.fire(makeGraphQLEntry())
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.requests.map((r) => r.id)).toEqual(['1', '2', '3'])
  })

  it('clear() empties the request list', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.requests).toHaveLength(2)
    act(() => {
      result.current.clear()
    })
    expect(result.current.requests).toHaveLength(0)
  })

  it('navigation event clears requests when autoClear is true', async () => {
    const { result } = renderHook(() => useGraphQLRequests(true))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.requests).toHaveLength(1)
    act(() => {
      mock.fireNavigated()
    })
    expect(result.current.requests).toHaveLength(0)
  })

  it('navigation event does NOT clear when autoClear is false', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.requests).toHaveLength(1)
    act(() => {
      mock.fireNavigated()
    })
    expect(result.current.requests).toHaveLength(1)
  })

  it('onNavigated listener is removed on unmount when autoClear is true', () => {
    const { unmount } = renderHook(() => useGraphQLRequests(true))
    expect(mock.onNavigatedAddListener).toHaveBeenCalledOnce()
    const registeredFn = mock.onNavigatedAddListener.mock.calls[0][0]
    unmount()
    expect(mock.onNavigatedRemoveListener).toHaveBeenCalledWith(registeredFn)
  })

  it('decodes base64-encoded response content', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const json = '{"data":{"hero":{"name":"Luke"}}}'
    await act(async () => {
      mock.fire(makeGraphQLEntry({}, btoa(json), 'base64'))
    })
    expect(result.current.requests[0].response).toBe(json)
  })

  it('falls back to raw content when base64 decoding fails', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const invalid = '!!!not-valid-base64!!!'
    await act(async () => {
      mock.fire(makeGraphQLEntry({}, invalid, 'base64'))
    })
    expect(result.current.requests[0].response).toBe(invalid)
  })

  it('toggling autoClear from false to true registers the navigation listener', () => {
    const { rerender } = renderHook(({ autoClear }) => useGraphQLRequests(autoClear), {
      initialProps: { autoClear: false },
    })
    expect(mock.onNavigatedAddListener).not.toHaveBeenCalled()
    rerender({ autoClear: true })
    expect(mock.onNavigatedAddListener).toHaveBeenCalledOnce()
  })
})
