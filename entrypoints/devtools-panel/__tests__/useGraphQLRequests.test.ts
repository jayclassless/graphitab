import { renderHook, act } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { HAREntry } from '../har'
import { useGraphQLRequests } from '../useGraphQLRequests'

type Listener = (entry: HAREntry) => void

function makeChromeMock() {
  let capturedListener: Listener | null = null
  const addListener = vi.fn((fn: Listener) => {
    capturedListener = fn
  })
  const removeListener = vi.fn((fn: Listener) => {
    if (capturedListener === fn) capturedListener = null
  })

  const chrome = {
    devtools: {
      network: {
        onRequestFinished: { addListener, removeListener },
      },
    },
  }

  function fire(entry: HAREntry) {
    capturedListener?.(entry)
  }

  return { chrome, addListener, removeListener, fire }
}

function makeGraphQLEntry(overrides: Partial<HAREntry['request']> = {}): HAREntry {
  return {
    request: {
      method: 'POST',
      url: 'https://api.example.com/graphql',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      ...overrides,
    },
    response: { status: 200, content: { size: 512 } },
    time: 123,
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
    const { result } = renderHook(() => useGraphQLRequests())
    expect(result.current).toEqual([])
  })

  it('registers listener on mount', () => {
    renderHook(() => useGraphQLRequests())
    expect(mock.addListener).toHaveBeenCalledOnce()
  })

  it('removes same listener on unmount', () => {
    const { unmount } = renderHook(() => useGraphQLRequests())
    const registeredFn = mock.addListener.mock.calls[0][0]
    unmount()
    expect(mock.removeListener).toHaveBeenCalledWith(registeredFn)
  })

  it('adds a GraphQLRequest entry when a matching HAR entry fires', () => {
    const { result } = renderHook(() => useGraphQLRequests())
    act(() => {
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({
      id: '1',
      operationName: 'GetHero',
      status: 200,
      size: 512,
      time: 123,
      url: 'https://api.example.com/graphql',
    })
  })

  it('ignores non-GraphQL entries', () => {
    const { result } = renderHook(() => useGraphQLRequests())
    act(() => {
      mock.fire(makeNonGraphQLEntry())
    })
    expect(result.current).toHaveLength(0)
  })

  it('multiple entries accumulate in order', () => {
    const { result } = renderHook(() => useGraphQLRequests())
    act(() => {
      mock.fire(makeGraphQLEntry())
      mock.fire(
        makeGraphQLEntry({
          postData: {
            text: JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' }),
          },
        })
      )
    })
    expect(result.current).toHaveLength(2)
    expect(result.current[0].operationName).toBe('GetHero')
    expect(result.current[1].operationName).toBe('CreateUser')
  })

  it('id increments monotonically across multiple entries', () => {
    const { result } = renderHook(() => useGraphQLRequests())
    act(() => {
      mock.fire(makeGraphQLEntry())
      mock.fire(makeGraphQLEntry())
      mock.fire(makeGraphQLEntry())
    })
    expect(result.current.map((r) => r.id)).toEqual(['1', '2', '3'])
  })
})
