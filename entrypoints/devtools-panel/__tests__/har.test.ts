import { describe, it, expect } from 'vitest'

import { isGraphQLEntry, extractOperationName } from '../har'
import type { HAREntry } from '../har'

function makeEntry(overrides: Partial<HAREntry> = {}): HAREntry {
  return {
    request: {
      method: 'POST',
      url: 'https://example.com/graphql',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: { text: JSON.stringify({ query: '{ hero { name } }' }) },
      ...overrides.request,
    },
    response: {
      status: 200,
      content: { size: 512 },
      ...overrides.response,
    },
    time: 123,
    ...overrides,
  }
}

describe('isGraphQLEntry', () => {
  it('POST with application/json and query field → true', () => {
    expect(isGraphQLEntry(makeEntry())).toBe(true)
  })

  it('POST with application/json but no query field → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ mutation: 'stuff' }) },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('POST with missing content-type header → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('POST with wrong content-type → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'text/plain' }],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('POST with invalid JSON body → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: 'not-json' },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('POST with no body → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('GET with query param → true', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?query=%7B%20hero%20%7D',
        headers: [],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(true)
  })

  it('GET without query param → false', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/api?foo=bar',
        headers: [],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('GET with malformed URL → false', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'not a url',
        headers: [],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('PUT method → false', () => {
    const entry = makeEntry({
      request: {
        method: 'PUT',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('DELETE method → false', () => {
    const entry = makeEntry({
      request: {
        method: 'DELETE',
        url: 'https://example.com/graphql',
        headers: [],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })
})

describe('extractOperationName', () => {
  it('POST: explicit operationName field → returned trimmed', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify({ operationName: '  GetHero  ', query: 'query GetHero { hero }' }),
        },
      },
    })
    expect(extractOperationName(entry)).toBe('GetHero')
  })

  it('POST: blank operationName falls through to query parsing', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify({ operationName: '   ', query: 'query MyQuery { hero }' }),
        },
      },
    })
    expect(extractOperationName(entry)).toBe('MyQuery')
  })

  it('POST: named query operation → name from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('GetHero')
  })

  it('POST: named mutation operation → name from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('CreateUser')
  })

  it('POST: named subscription operation → name from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'subscription OnMessage { message { id } }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('OnMessage')
  })

  it('POST: anonymous operation with keyword → capitalized type', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'mutation { createUser { id } }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('Mutation')
  })

  it('POST: shorthand query → "Query"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('Query')
  })

  it('POST: invalid query string → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '!@#invalid' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('POST: no body → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('POST: invalid JSON → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: 'not-json' },
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('GET: operationName param present → returned trimmed', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?query=%7B%20hero%20%7D&operationName=GetHero',
        headers: [],
      },
    })
    expect(extractOperationName(entry)).toBe('GetHero')
  })

  it('GET: no operationName, query param with named op → name from AST', () => {
    const query = encodeURIComponent('query GetHero { hero { name } }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractOperationName(entry)).toBe('GetHero')
  })

  it('GET: no operationName, shorthand query → "Query"', () => {
    const query = encodeURIComponent('{ hero }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractOperationName(entry)).toBe('Query')
  })

  it('GET: malformed URL → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'not a url',
        headers: [],
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('POST: body has no query field (non-string query) → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ variables: { id: '1' } }) },
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('GET: valid URL with no query param → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?variables=%7B%7D',
        headers: [],
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })

  it('fragment-only document (no OperationDefinition) → "Anonymous"', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'fragment F on Query { hero { name } }' }) },
      },
    })
    expect(extractOperationName(entry)).toBe('Anonymous')
  })
})
