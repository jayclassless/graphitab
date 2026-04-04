import { describe, it, expect, beforeEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing'

import type { GraphQLRequest } from '~/entrypoints/devtools-panel/har'

import {
  canOpenInGraphiQL,
  findProfileByUrl,
  stripGraphQLParams,
  buildInitialState,
  storeInitialState,
  consumeInitialState,
} from '../open_in_graphiql'
import type { Profile } from '../profiles'

function makeRequest(overrides: Partial<GraphQLRequest> = {}): GraphQLRequest {
  return {
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
    ...overrides,
  }
}

describe('canOpenInGraphiQL', () => {
  it('returns true for a normal query', () => {
    expect(canOpenInGraphiQL(makeRequest())).toBe(true)
  })

  it('returns true for a mutation', () => {
    expect(canOpenInGraphiQL(makeRequest({ operationType: 'mutation' }))).toBe(true)
  })

  it('returns true for a subscription', () => {
    expect(canOpenInGraphiQL(makeRequest({ operationType: 'subscription' }))).toBe(true)
  })

  it('returns false for a batch request', () => {
    expect(canOpenInGraphiQL(makeRequest({ operationType: 'batch' }))).toBe(false)
  })

  it('returns false for an APQ request without a query', () => {
    expect(canOpenInGraphiQL(makeRequest({ persisted: true, query: '' }))).toBe(false)
  })

  it('returns true for an APQ request that includes a query', () => {
    expect(
      canOpenInGraphiQL(makeRequest({ persisted: true, query: 'query GetHero { hero { name } }' }))
    ).toBe(true)
  })
})

describe('findProfileByUrl', () => {
  const profiles: Profile[] = [
    { id: '1', name: 'API', url: 'https://api.example.com/graphql' },
    { id: '2', name: 'Other', url: 'https://other.example.com/graphql/' },
  ]

  it('finds a profile with an exact URL match', () => {
    expect(findProfileByUrl(profiles, 'https://api.example.com/graphql')).toEqual(profiles[0])
  })

  it('matches ignoring trailing slash on the request URL', () => {
    expect(findProfileByUrl(profiles, 'https://api.example.com/graphql/')).toEqual(profiles[0])
  })

  it('matches ignoring trailing slash on the profile URL', () => {
    expect(findProfileByUrl(profiles, 'https://other.example.com/graphql')).toEqual(profiles[1])
  })

  it('matches ignoring GraphQL query params on the request URL', () => {
    expect(
      findProfileByUrl(
        profiles,
        'https://api.example.com/graphql?query=%7Bhero%7D&operationName=GetHero'
      )
    ).toEqual(profiles[0])
  })

  it('matches when both URLs have the same non-GraphQL query params', () => {
    const profilesWithQs: Profile[] = [
      { id: '1', name: 'API', url: 'https://api.example.com/graphql?token=abc' },
    ]
    expect(
      findProfileByUrl(profilesWithQs, 'https://api.example.com/graphql?token=abc&query=%7Bhero%7D')
    ).toEqual(profilesWithQs[0])
  })

  it('matches when non-GraphQL query params appear in different order', () => {
    const profilesWithQs: Profile[] = [
      { id: '1', name: 'API', url: 'https://api.example.com/graphql?b=2&a=1' },
    ]
    expect(findProfileByUrl(profilesWithQs, 'https://api.example.com/graphql?a=1&b=2')).toEqual(
      profilesWithQs[0]
    )
  })

  it('does not match when non-GraphQL query params differ', () => {
    const profilesWithQs: Profile[] = [
      { id: '1', name: 'API', url: 'https://api.example.com/graphql?token=abc' },
    ]
    expect(
      findProfileByUrl(profilesWithQs, 'https://api.example.com/graphql?token=xyz')
    ).toBeUndefined()
  })

  it('does not match when the request has extra non-GraphQL query params', () => {
    expect(findProfileByUrl(profiles, 'https://api.example.com/graphql?token=abc')).toBeUndefined()
  })

  it('returns undefined when no profile matches', () => {
    expect(findProfileByUrl(profiles, 'https://unknown.example.com/graphql')).toBeUndefined()
  })

  it('returns undefined for an empty profiles list', () => {
    expect(findProfileByUrl([], 'https://api.example.com/graphql')).toBeUndefined()
  })
})

describe('stripGraphQLParams', () => {
  it('removes the query param', () => {
    expect(stripGraphQLParams('https://example.com/graphql?query=%7Bhero%7D')).toBe(
      'https://example.com/graphql'
    )
  })

  it('removes operationName, variables, and extensions', () => {
    expect(
      stripGraphQLParams(
        'https://example.com/graphql?query=%7Bhero%7D&operationName=GetHero&variables=%7B%7D&extensions=%7B%7D'
      )
    ).toBe('https://example.com/graphql')
  })

  it('preserves non-GraphQL query params', () => {
    expect(
      stripGraphQLParams('https://example.com/graphql?token=abc&query=%7Bhero%7D&debug=true')
    ).toBe('https://example.com/graphql?token=abc&debug=true')
  })

  it('returns the URL unchanged when there are no GraphQL params', () => {
    expect(stripGraphQLParams('https://example.com/graphql')).toBe('https://example.com/graphql')
  })

  it('returns the URL unchanged for a POST-style URL without query params', () => {
    expect(stripGraphQLParams('https://example.com/graphql')).toBe('https://example.com/graphql')
  })

  it('returns the original string for an invalid URL', () => {
    expect(stripGraphQLParams('not-a-url')).toBe('not-a-url')
  })
})

describe('buildInitialState', () => {
  it('includes query', () => {
    const state = buildInitialState(makeRequest())
    expect(state.query).toBe('query GetHero { hero { name } }')
  })

  it('includes variables when present', () => {
    const state = buildInitialState(makeRequest({ variables: '{"id":"1"}' }))
    expect(state.variables).toBe('{"id":"1"}')
  })

  it('omits variables when not present', () => {
    const state = buildInitialState(makeRequest())
    expect(state.variables).toBeUndefined()
  })

  it('includes extensions when present', () => {
    const state = buildInitialState(makeRequest({ extensions: '{"foo":"bar"}' }))
    expect(state.extensions).toBe('{"foo":"bar"}')
  })

  it('omits extensions when not present', () => {
    const state = buildInitialState(makeRequest())
    expect(state.extensions).toBeUndefined()
  })

  it('extracts Authorization header (case-insensitive)', () => {
    const state = buildInitialState(
      makeRequest({
        headers: [
          { name: 'content-type', value: 'application/json' },
          { name: 'authorization', value: 'Bearer token123' },
        ],
      })
    )
    expect(state.headers).toBe(JSON.stringify({ Authorization: 'Bearer token123' }, null, 2))
  })

  it('extracts Authorization header with mixed case', () => {
    const state = buildInitialState(
      makeRequest({
        headers: [{ name: 'Authorization', value: 'Bearer abc' }],
      })
    )
    expect(state.headers).toBe(JSON.stringify({ Authorization: 'Bearer abc' }, null, 2))
  })

  it('omits headers when no Authorization header exists', () => {
    const state = buildInitialState(
      makeRequest({
        headers: [{ name: 'content-type', value: 'application/json' }],
      })
    )
    expect(state.headers).toBeUndefined()
  })
})

describe('storeInitialState / consumeInitialState', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('round-trips state through session storage', async () => {
    const state = { query: 'query { hero }', variables: '{"id":"1"}' }
    await storeInitialState('profile-1', state)
    const result = await consumeInitialState('profile-1')
    expect(result).toEqual(state)
  })

  it('returns null and removes the key on second consume', async () => {
    const state = { query: 'query { hero }' }
    await storeInitialState('profile-1', state)
    await consumeInitialState('profile-1')
    const second = await consumeInitialState('profile-1')
    expect(second).toBeNull()
  })

  it('returns null when no state was stored', async () => {
    const result = await consumeInitialState('nonexistent')
    expect(result).toBeNull()
  })
})
