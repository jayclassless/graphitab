import { renderHook, act } from '@testing-library/react'
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { HAREntry } from '../har'
import { isNavigationDivider } from '../har'
import { useGraphQLRequests } from '../useGraphQLRequests'

type RequestListener = (entry: HAREntry) => void
type NavigatedListener = (url: string) => void

// vi.hoisted runs before vi.mock factories, ensuring these are defined first
const {
  onRequestFinishedAddListener,
  onRequestFinishedRemoveListener,
  onNavigatedAddListener,
  onNavigatedRemoveListener,
} = vi.hoisted(() => ({
  onRequestFinishedAddListener: vi.fn<(fn: RequestListener) => void>(),
  onRequestFinishedRemoveListener: vi.fn<(fn: RequestListener) => void>(),
  onNavigatedAddListener: vi.fn<(fn: NavigatedListener) => void>(),
  onNavigatedRemoveListener: vi.fn<(fn: NavigatedListener) => void>(),
}))

vi.mock('wxt/browser', () => ({
  browser: {
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
  },
}))

// Capture state reset per-test in beforeEach
let capturedRequestListener: RequestListener | null = null
let capturedNavigatedListeners: NavigatedListener[] = []

function fire(entry: HAREntry) {
  capturedRequestListener?.(entry)
}

function fireNavigated(url = 'https://example.com') {
  capturedNavigatedListeners.forEach((l) => l(url))
}

function makeGraphQLEntry(
  requestOverrides: Partial<HAREntry['request']> = {},
  responseBody = '{"data":{"hero":{"name":"Luke"}}}',
  encoding = '',
  responseHeaders?: Array<{ name: string; value: string }>
): HAREntry {
  return {
    request: {
      method: 'POST',
      url: 'https://api.example.com/graphql',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      ...requestOverrides,
    },
    response: { status: 200, content: { size: 512 }, headers: responseHeaders },
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
  beforeEach(() => {
    capturedRequestListener = null
    capturedNavigatedListeners = []
    vi.clearAllMocks()
    onRequestFinishedAddListener.mockImplementation((fn: RequestListener) => {
      capturedRequestListener = fn
    })
    onRequestFinishedRemoveListener.mockImplementation((fn: RequestListener) => {
      if (capturedRequestListener === fn) capturedRequestListener = null
    })
    onNavigatedAddListener.mockImplementation((fn: NavigatedListener) => {
      capturedNavigatedListeners.push(fn)
    })
    onNavigatedRemoveListener.mockImplementation((fn: NavigatedListener) => {
      capturedNavigatedListeners = capturedNavigatedListeners.filter((l) => l !== fn)
    })
  })

  it('returns empty array initially', () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    expect(result.current.entries).toEqual([])
  })

  it('registers listener on mount', () => {
    renderHook(() => useGraphQLRequests(false))
    expect(onRequestFinishedAddListener).toHaveBeenCalledOnce()
  })

  it('removes same listener on unmount', () => {
    const { unmount } = renderHook(() => useGraphQLRequests(false))
    const registeredFn = onRequestFinishedAddListener.mock.calls[0][0]
    unmount()
    expect(onRequestFinishedRemoveListener).toHaveBeenCalledWith(registeredFn)
  })

  it('adds a GraphQLRequest entry when a matching HAR entry fires', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0]).toMatchObject({
      id: '1',
      operationName: 'GetHero',
      operationType: 'query',
      status: 200,
      size: 512,
      time: 123,
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: [{ name: 'content-type', value: 'application/json' }],
      query: 'query GetHero { hero { name } }',
      response: '{"data":{"hero":{"name":"Luke"}}}',
    })
  })

  it('stores variables when present in the request', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(
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
    expect(result.current.entries[0]).toMatchObject({
      query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
      variables: '{\n  "id": "1"\n}',
    })
  })

  it('response is undefined when getContent returns empty string', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry({}, ''))
    })
    expect((result.current.entries[0] as { response?: string }).response).toBeUndefined()
  })

  it('ignores non-GraphQL entries', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeNonGraphQLEntry())
    })
    expect(result.current.entries).toHaveLength(0)
  })

  it('multiple entries accumulate in order', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
      fire(
        makeGraphQLEntry({
          postData: {
            text: JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' }),
          },
        })
      )
    })
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0]).toMatchObject({
      operationName: 'GetHero',
      operationType: 'query',
    })
    expect(result.current.entries[1]).toMatchObject({
      operationName: 'CreateUser',
      operationType: 'mutation',
    })
  })

  it('id increments monotonically across multiple entries', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
      fire(makeGraphQLEntry())
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries.map((r) => r.id)).toEqual(['1', '2', '3'])
  })

  it('clear() empties the entries list', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries).toHaveLength(2)
    act(() => {
      result.current.clear()
    })
    expect(result.current.entries).toHaveLength(0)
  })

  it('navigation event clears entries when autoClear is true', async () => {
    const { result } = renderHook(() => useGraphQLRequests(true))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries).toHaveLength(1)
    act(() => {
      fireNavigated()
    })
    expect(result.current.entries).toHaveLength(0)
  })

  it('navigation event inserts a divider when autoClear is false', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries).toHaveLength(1)
    act(() => {
      fireNavigated('https://example.com/page2')
    })
    expect(result.current.entries).toHaveLength(2)
    const divider = result.current.entries[1]
    expect(isNavigationDivider(divider)).toBe(true)
    if (isNavigationDivider(divider)) {
      expect(divider.url).toBe('https://example.com/page2')
    }
  })

  it('navigation divider has a unique id from the shared counter', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    act(() => {
      fireNavigated('https://example.com')
    })
    expect(result.current.entries[0].id).toBe('1')
    expect(result.current.entries[1].id).toBe('2')
  })

  it('multiple navigations insert multiple dividers', () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    act(() => {
      fireNavigated('https://example.com/a')
    })
    act(() => {
      fireNavigated('https://example.com/b')
    })
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries.every(isNavigationDivider)).toBe(true)
  })

  it('onNavigated listener is always registered regardless of autoClear', () => {
    renderHook(() => useGraphQLRequests(false))
    expect(onNavigatedAddListener).toHaveBeenCalledOnce()
  })

  it('onNavigated listener is removed on unmount when autoClear is true', () => {
    const { unmount } = renderHook(() => useGraphQLRequests(true))
    expect(onNavigatedAddListener).toHaveBeenCalledOnce()
    const registeredFn = onNavigatedAddListener.mock.calls[0][0]
    unmount()
    expect(onNavigatedRemoveListener).toHaveBeenCalledWith(registeredFn)
  })

  it('decodes base64-encoded response content', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const json = '{"data":{"hero":{"name":"Luke"}}}'
    await act(async () => {
      fire(makeGraphQLEntry({}, btoa(json), 'base64'))
    })
    expect((result.current.entries[0] as { response?: string }).response).toBe(json)
  })

  it('captures response headers when present in the HAR entry', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const headers = [
      { name: 'content-type', value: 'application/json' },
      { name: 'x-request-id', value: 'abc123' },
    ]
    await act(async () => {
      fire(makeGraphQLEntry({}, undefined, '', headers))
    })
    expect(
      (result.current.entries[0] as { responseHeaders?: typeof headers }).responseHeaders
    ).toEqual(headers)
  })

  it('responseHeaders is undefined when not present in the HAR entry', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(
      (result.current.entries[0] as { responseHeaders?: unknown }).responseHeaders
    ).toBeUndefined()
  })

  it('falls back to raw content when base64 decoding fails', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const invalid = '!!!not-valid-base64!!!'
    await act(async () => {
      fire(makeGraphQLEntry({}, invalid, 'base64'))
    })
    expect((result.current.entries[0] as { response?: string }).response).toBe(invalid)
  })

  it('toggling autoClear from false to true re-registers the navigation listener', () => {
    const { rerender } = renderHook(({ autoClear }) => useGraphQLRequests(autoClear), {
      initialProps: { autoClear: false },
    })
    expect(onNavigatedAddListener).toHaveBeenCalledOnce()
    rerender({ autoClear: true })
    expect(onNavigatedAddListener).toHaveBeenCalledTimes(2)
  })

  it('toggling autoClear from true to false re-registers the navigation listener', () => {
    const { rerender } = renderHook(({ autoClear }) => useGraphQLRequests(autoClear), {
      initialProps: { autoClear: true },
    })
    expect(onNavigatedAddListener).toHaveBeenCalledOnce()
    const registeredFn = onNavigatedAddListener.mock.calls[0][0]
    rerender({ autoClear: false })
    expect(onNavigatedRemoveListener).toHaveBeenCalledWith(registeredFn)
    expect(onNavigatedAddListener).toHaveBeenCalledTimes(2)
  })

  it('stores rawBody from postData.text', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect((result.current.entries[0] as { rawBody?: string }).rawBody).toBe(
      JSON.stringify({ query: 'query GetHero { hero { name } }' })
    )
  })

  it('rawBody is undefined when there is no postData (GET request)', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(
        makeGraphQLEntry({
          method: 'GET',
          url: 'https://api.example.com/graphql?query=%7B%20hero%20%7D',
          headers: [],
          postData: undefined,
        })
      )
    })
    expect((result.current.entries[0] as { rawBody?: string }).rawBody).toBeUndefined()
  })

  it('stores extensions when present in the request body', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(
        makeGraphQLEntry({
          postData: {
            text: JSON.stringify({
              query: '{ hero }',
              extensions: { persistedQuery: { version: 1 } },
            }),
          },
        })
      )
    })
    expect((result.current.entries[0] as { extensions?: string }).extensions).toBe(
      '{\n  "persistedQuery": {\n    "version": 1\n  }\n}'
    )
  })

  it('captures a GET-based GraphQL request', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(
        makeGraphQLEntry({
          method: 'GET',
          url: 'https://api.example.com/graphql?query=query%20GetHero%20%7B%20hero%20%7B%20name%20%7D%20%7D',
          headers: [],
          postData: undefined,
        })
      )
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0]).toMatchObject({
      method: 'GET',
      operationName: 'GetHero',
      operationType: 'query',
      query: 'query GetHero { hero { name } }',
    })
  })

  it('id counter continues incrementing after clear() — does not reset', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
      fire(makeGraphQLEntry())
    })
    act(() => {
      result.current.clear()
    })
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(result.current.entries[0].id).toBe('3')
  })

  it('sets batchedOperations on batch requests with parsed operations', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const batchBody = JSON.stringify([
      { query: 'query GetHero { hero { name } }' },
      { query: 'mutation CreateUser { createUser { id } }' },
    ])
    const batchResponse = JSON.stringify([
      { data: { hero: { name: 'Luke' } } },
      { data: { createUser: { id: '1' } } },
    ])
    await act(async () => {
      fire(makeGraphQLEntry({ postData: { text: batchBody } }, batchResponse))
    })
    const req = result.current.entries[0]
    expect(req).toMatchObject({ operationType: 'batch', operationName: 'GetHero' })
    const batchedOps = (req as { batchedOperations?: unknown[] }).batchedOperations
    expect(batchedOps).toHaveLength(2)
    expect(batchedOps![0]).toMatchObject({
      operationName: 'GetHero',
      operationType: 'query',
      query: 'query GetHero { hero { name } }',
    })
    expect(batchedOps![1]).toMatchObject({
      operationName: 'CreateUser',
      operationType: 'mutation',
      query: 'mutation CreateUser { createUser { id } }',
    })
  })

  it('batchedOperations includes individual responses from the batch response array', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    const batchBody = JSON.stringify([
      { query: 'query GetHero { hero { name } }' },
      { query: 'query GetVillain { villain { name } }' },
    ])
    const batchResponse = JSON.stringify([
      { data: { hero: { name: 'Luke' } } },
      { data: { villain: { name: 'Vader' } } },
    ])
    await act(async () => {
      fire(makeGraphQLEntry({ postData: { text: batchBody } }, batchResponse))
    })
    const ops = (result.current.entries[0] as { batchedOperations: { response?: string }[] })
      .batchedOperations
    expect(ops[0].response).toBe(JSON.stringify({ data: { hero: { name: 'Luke' } } }, null, 2))
    expect(ops[1].response).toBe(JSON.stringify({ data: { villain: { name: 'Vader' } } }, null, 2))
  })

  it('batchedOperations is undefined for non-batch requests', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    expect(
      (result.current.entries[0] as { batchedOperations?: unknown }).batchedOperations
    ).toBeUndefined()
  })

  it('clear() removes navigation dividers along with requests', async () => {
    const { result } = renderHook(() => useGraphQLRequests(false))
    await act(async () => {
      fire(makeGraphQLEntry())
    })
    act(() => {
      fireNavigated('https://example.com')
    })
    expect(result.current.entries).toHaveLength(2)
    act(() => {
      result.current.clear()
    })
    expect(result.current.entries).toHaveLength(0)
  })
})
