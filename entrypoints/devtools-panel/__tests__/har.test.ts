import { describe, it, expect } from 'vitest'

import {
  isGraphQLEntry,
  extractOperationInfo,
  extractQueryAndVariables,
  buildCurlCommand,
} from '../har'
import type { HAREntry, GraphQLRequest } from '../har'

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
    getContent: () => {},
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

describe('extractQueryAndVariables', () => {
  it('POST with query only → query returned, no variables', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: 'query GetHero { hero { name } }' }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: 'query GetHero { hero { name } }',
      variables: undefined,
    })
  })

  it('POST with query and object variables → both returned, variables pretty-printed', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify({
            query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
            variables: { id: '1' },
          }),
        },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
      variables: '{\n  "id": "1"\n}',
    })
  })

  it('POST with null variables → no variables', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }', variables: null }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '{ hero }', variables: undefined })
  })

  it('POST with non-object variables (string) → no variables', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }', variables: 'not-an-object' }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '{ hero }', variables: undefined })
  })

  it('POST with invalid JSON body → empty query', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: 'not-json' },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '' })
  })

  it('POST with no body → empty query', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '' })
  })

  it('GET with query param only → query returned, no variables', () => {
    const query = encodeURIComponent('query GetHero { hero { name } }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: 'query GetHero { hero { name } }',
      variables: undefined,
    })
  })

  it('GET with query and variables params → both returned', () => {
    const query = encodeURIComponent('query GetHero($id: ID!) { hero(id: $id) { name } }')
    const variables = encodeURIComponent(JSON.stringify({ id: '1' }))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}&variables=${variables}`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: 'query GetHero($id: ID!) { hero(id: $id) { name } }',
      variables: '{\n  "id": "1"\n}',
    })
  })

  it('GET with invalid variables param → query returned, no variables', () => {
    const query = encodeURIComponent('{ hero }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}&variables=not-json`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
    })
  })

  it('GET with no query param → empty query', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?foo=bar',
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '' })
  })

  it('unrecognized method → empty query', () => {
    const entry = makeEntry({
      request: {
        method: 'PUT',
        url: 'https://example.com/graphql',
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({ query: '' })
  })
})

describe('buildCurlCommand', () => {
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

  it('POST with headers and no variables → correct -X, -H flag and --data-raw without variables key', () => {
    const cmd = buildCurlCommand(makeRequest())
    expect(cmd).toBe(
      "curl -X POST 'https://api.example.com/graphql'" +
        " -H 'content-type: application/json'" +
        ' --data-raw \'{"query":"query GetHero { hero { name } }"}\''
    )
  })

  it('POST with variables → --data-raw body includes parsed variables object', () => {
    const cmd = buildCurlCommand(makeRequest({ variables: '{\n  "id": "1"\n}' }))
    expect(cmd).toContain(
      '--data-raw \'{"query":"query GetHero { hero { name } }","variables":{"id":"1"}}\''
    )
  })

  it('POST with non-JSON variables → variables key omitted from body', () => {
    const cmd = buildCurlCommand(makeRequest({ variables: 'not json' }))
    expect(cmd).toContain('--data-raw \'{"query":"query GetHero { hero { name } }"}\'')
    expect(cmd).not.toContain('variables')
  })

  it('GET request → no --data-raw, URL used as-is', () => {
    const cmd = buildCurlCommand(
      makeRequest({
        method: 'GET',
        url: 'https://api.example.com/graphql?query=%7B%20hero%20%7D',
        headers: [],
      })
    )
    expect(cmd).toBe("curl -X GET 'https://api.example.com/graphql?query=%7B%20hero%20%7D'")
    expect(cmd).not.toContain('--data-raw')
  })

  it('skips headers with : prefix (HTTP/2 pseudo-headers)', () => {
    const cmd = buildCurlCommand(
      makeRequest({ headers: [{ name: ':authority', value: 'api.example.com' }] })
    )
    expect(cmd).not.toContain(':authority')
  })

  it('skips headers with sec- prefix (browser security headers)', () => {
    const cmd = buildCurlCommand(
      makeRequest({ headers: [{ name: 'sec-fetch-site', value: 'same-origin' }] })
    )
    expect(cmd).not.toContain('sec-fetch-site')
  })

  it('skips content-length header', () => {
    const cmd = buildCurlCommand(
      makeRequest({ headers: [{ name: 'content-length', value: '42' }] })
    )
    expect(cmd).not.toContain('content-length')
  })

  it('includes authorization and custom headers', () => {
    const cmd = buildCurlCommand(
      makeRequest({
        headers: [
          { name: 'authorization', value: 'Bearer token123' },
          { name: 'x-custom', value: 'value' },
        ],
      })
    )
    expect(cmd).toContain("-H 'authorization: Bearer token123'")
    expect(cmd).toContain("-H 'x-custom: value'")
  })

  it('escapes single quotes in header values', () => {
    const cmd = buildCurlCommand(
      makeRequest({ headers: [{ name: 'x-header', value: "it's a value" }] })
    )
    expect(cmd).toContain("-H 'x-header: it'\\''s a value'")
  })

  it('escapes single quotes in the URL', () => {
    const cmd = buildCurlCommand(makeRequest({ url: "https://example.com/it's", headers: [] }))
    expect(cmd).toContain("curl -X POST 'https://example.com/it'\\''s'")
  })
})
