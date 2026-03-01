import { describe, it, expect } from 'vitest'

import { isGraphQLEntry, extractOperationInfo } from '../har'
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

describe('extractOperationInfo', () => {
  it('POST: named query → name and type from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'query',
    })
  })

  it('POST: named mutation → name and type from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'CreateUser',
      operationType: 'mutation',
    })
  })

  it('POST: named subscription → name and type from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'subscription OnMessage { message { id } }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'OnMessage',
      operationType: 'subscription',
    })
  })

  it('POST: explicit operationName overrides AST name, type still from AST', () => {
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
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'query',
    })
  })

  it('POST: blank operationName falls through to AST name', () => {
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
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'MyQuery',
      operationType: 'query',
    })
  })

  it('POST: anonymous mutation → capitalized type as name, mutation type', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'mutation { createUser { id } }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Mutation',
      operationType: 'mutation',
    })
  })

  it('POST: shorthand query → "Query" name, query type', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({ operationName: 'Query', operationType: 'query' })
  })

  it('POST: invalid query string → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '!@#invalid' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('POST: no body → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('POST: invalid JSON → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: 'not-json' },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('POST: body has no query field → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ variables: { id: '1' } }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('POST: fragment-only document → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'fragment F on Query { hero { name } }' }) },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('GET: named query param → name and type from AST', () => {
    const query = encodeURIComponent('query GetHero { hero { name } }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'query',
    })
  })

  it('GET: operationName param overrides AST name, type still from AST', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?query=%7B%20hero%20%7D&operationName=GetHero',
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'query',
    })
  })

  it('GET: shorthand query with no operationName → "Query", query type', () => {
    const query = encodeURIComponent('{ hero }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({ operationName: 'Query', operationType: 'query' })
  })

  it('GET: valid URL with no query param → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?variables=%7B%7D',
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })

  it('GET: malformed URL → Anonymous, unknown', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'not a url',
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Anonymous',
      operationType: 'unknown',
    })
  })
})
