import { describe, it, expect } from 'vitest'

import {
  isGraphQLEntry,
  extractOperationInfo,
  extractQueryAndVariables,
  extractBatchedOperations,
  buildCurlCommand,
  hasPersistedQuery,
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

  it('POST with extensions object → extensions pretty-printed', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify({ query: '{ hero }', extensions: { tracing: true } }),
        },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: '{\n  "tracing": true\n}',
    })
  })

  it('POST with null extensions → no extensions', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }', extensions: null }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: undefined,
    })
  })

  it('POST with non-object extensions (string) → no extensions', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }', extensions: 'not-an-object' }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: undefined,
    })
  })

  it('POST with no extensions field → no extensions', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }' }) },
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: undefined,
    })
  })

  it('GET with valid extensions param → extensions pretty-printed', () => {
    const query = encodeURIComponent('{ hero }')
    const extensions = encodeURIComponent(JSON.stringify({ tracing: true }))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}&extensions=${extensions}`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: '{\n  "tracing": true\n}',
    })
  })

  it('GET with invalid extensions param → no extensions', () => {
    const query = encodeURIComponent('{ hero }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}&extensions=not-json`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: undefined,
    })
  })

  it('GET with no extensions param → no extensions', () => {
    const query = encodeURIComponent('{ hero }')
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?query=${query}`,
        headers: [],
      },
    })
    expect(extractQueryAndVariables(entry)).toEqual({
      query: '{ hero }',
      variables: undefined,
      extensions: undefined,
    })
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

  it('POST with extensions → --data-raw body includes parsed extensions object', () => {
    const cmd = buildCurlCommand(makeRequest({ extensions: '{"persistedQuery":{"version":1}}' }))
    expect(cmd).toContain(
      '--data-raw \'{"query":"query GetHero { hero { name } }","extensions":{"persistedQuery":{"version":1}}}\''
    )
  })

  it('POST with non-JSON extensions → extensions key omitted from body', () => {
    const cmd = buildCurlCommand(makeRequest({ extensions: 'not json' }))
    expect(cmd).toContain('--data-raw \'{"query":"query GetHero { hero { name } }"}\'')
    expect(cmd).not.toContain('extensions')
  })

  it('POST with variables and extensions → body includes both', () => {
    const cmd = buildCurlCommand(
      makeRequest({ variables: '{"id":"1"}', extensions: '{"persistedQuery":{"version":1}}' })
    )
    expect(cmd).toContain('"variables":{"id":"1"}')
    expect(cmd).toContain('"extensions":{"persistedQuery":{"version":1}}')
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

  it('POST with rawBody → uses rawBody directly as --data-raw', () => {
    const rawBody = '[{"query":"{ hero }"},{"query":"{ villain }"}]'
    const cmd = buildCurlCommand(
      makeRequest({
        rawBody,
        headers: [{ name: 'content-type', value: 'application/json' }],
      })
    )
    expect(cmd).toContain(`--data-raw '${rawBody}'`)
    expect(cmd).not.toContain('"query":"query GetHero')
  })
})

describe('isGraphQLEntry — batch', () => {
  it('POST with JSON array where all items have query → true', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([
            { query: 'query GetHero { hero { name } }' },
            { query: 'query GetVillain { villain { name } }' },
          ]),
        },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(true)
  })

  it('POST with empty array → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: '[]' },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })

  it('POST with array where some items missing query → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([
            { query: 'query GetHero { hero { name } }' },
            { operationName: 'NoQuery' },
          ]),
        },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(false)
  })
})

describe('extractOperationInfo — batch', () => {
  it('batch POST → returns first operation name and batch type', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([
            { query: 'query GetHero { hero { name } }' },
            { query: 'mutation CreateUser { createUser { id } }' },
          ]),
        },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'batch',
    })
  })

  it('batch POST with explicit operationName on first item → uses it', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([
            { operationName: 'MyHero', query: 'query GetHero { hero { name } }' },
            { query: 'mutation CreateUser { createUser { id } }' },
          ]),
        },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'MyHero',
      operationType: 'batch',
    })
  })

  it('batch POST with anonymous first operation → uses parsed name', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([
            { query: '{ hero { name } }' },
            { query: 'query GetVillain { villain { name } }' },
          ]),
        },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'Query',
      operationType: 'batch',
    })
  })
})

describe('extractBatchedOperations', () => {
  function makeBatchEntry(
    items: Array<{ query: string; operationName?: string; variables?: object }>,
    overrides: Partial<HAREntry> = {}
  ): HAREntry {
    return makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify(items) },
      },
      ...overrides,
    })
  }

  it('parses each operation name and query from the batch array', () => {
    const entry = makeBatchEntry([
      { query: 'query GetHero { hero { name } }' },
      { query: 'mutation CreateUser { createUser { id } }' },
    ])
    const ops = extractBatchedOperations(entry, undefined)
    expect(ops).toHaveLength(2)
    expect(ops[0]).toMatchObject({
      operationName: 'GetHero',
      operationType: 'query',
      query: 'query GetHero { hero { name } }',
    })
    expect(ops[1]).toMatchObject({
      operationName: 'CreateUser',
      operationType: 'mutation',
      query: 'mutation CreateUser { createUser { id } }',
    })
  })

  it('uses explicit operationName when present on each item', () => {
    const entry = makeBatchEntry([
      { operationName: 'MyHero', query: 'query GetHero { hero { name } }' },
    ])
    const ops = extractBatchedOperations(entry, undefined)
    expect(ops[0].operationName).toBe('MyHero')
  })

  it('distributes individual responses from the batch response array', () => {
    const entry = makeBatchEntry([
      { query: 'query GetHero { hero { name } }' },
      { query: 'query GetVillain { villain { name } }' },
    ])
    const responseText = JSON.stringify([
      { data: { hero: { name: 'Luke' } } },
      { data: { villain: { name: 'Vader' } } },
    ])
    const ops = extractBatchedOperations(entry, responseText)
    expect(ops[0].response).toBe(JSON.stringify({ data: { hero: { name: 'Luke' } } }, null, 2))
    expect(ops[1].response).toBe(JSON.stringify({ data: { villain: { name: 'Vader' } } }, null, 2))
  })

  it('leaves response undefined when responseText is not an array', () => {
    const entry = makeBatchEntry([{ query: '{ hero { name } }' }])
    const ops = extractBatchedOperations(entry, '{"data":{"hero":{"name":"Luke"}}}')
    expect(ops[0].response).toBeUndefined()
  })

  it('leaves response undefined when responseText is undefined', () => {
    const entry = makeBatchEntry([{ query: '{ hero { name } }' }])
    const ops = extractBatchedOperations(entry, undefined)
    expect(ops[0].response).toBeUndefined()
  })

  it('parses variables from each item', () => {
    const entry = makeBatchEntry([
      { query: 'query GetHero($id: ID!) { hero(id: $id) { name } }', variables: { id: '1' } },
    ])
    const ops = extractBatchedOperations(entry, undefined)
    expect(ops[0].variables).toBe('{\n  "id": "1"\n}')
  })

  it('returns empty array when postData is missing', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
      },
    })
    expect(extractBatchedOperations(entry, undefined)).toEqual([])
  })

  it('returns empty array when body is not an array', () => {
    const entry = makeEntry()
    expect(extractBatchedOperations(entry, undefined)).toEqual([])
  })
})

const APQ_HASH = 'ecf4edb46db40b5132295c0291d62fb65d6759a9eedfa4d5d612dd5ec54a6b38'
const APQ_EXTENSIONS = { persistedQuery: { version: 1, sha256Hash: APQ_HASH } }

function makeApqEntry(overrides: Partial<HAREntry['request']> = {}): HAREntry {
  return makeEntry({
    request: {
      method: 'POST',
      url: 'https://example.com/graphql',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: {
        text: JSON.stringify({ extensions: APQ_EXTENSIONS }),
      },
      ...overrides,
    },
  })
}

describe('hasPersistedQuery', () => {
  it('POST with extensions.persistedQuery.sha256Hash → true', () => {
    expect(hasPersistedQuery(makeApqEntry())).toBe(true)
  })

  it('POST with query + extensions.persistedQuery → true', () => {
    const entry = makeApqEntry({
      postData: {
        text: JSON.stringify({ query: '{ hero }', extensions: APQ_EXTENSIONS }),
      },
    })
    expect(hasPersistedQuery(entry)).toBe(true)
  })

  it('POST without persistedQuery extension → false', () => {
    expect(hasPersistedQuery(makeEntry())).toBe(false)
  })

  it('POST with extensions but no persistedQuery → false', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: { text: JSON.stringify({ query: '{ hero }', extensions: { tracing: true } }) },
      },
    })
    expect(hasPersistedQuery(entry)).toBe(false)
  })

  it('GET with extensions param containing persistedQuery → true', () => {
    const extensions = encodeURIComponent(JSON.stringify(APQ_EXTENSIONS))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?extensions=${extensions}`,
        headers: [],
      },
    })
    expect(hasPersistedQuery(entry)).toBe(true)
  })

  it('GET without extensions param → false', () => {
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: 'https://example.com/graphql?query=%7B%20hero%20%7D',
        headers: [],
      },
    })
    expect(hasPersistedQuery(entry)).toBe(false)
  })

  it('batch POST where some items have persistedQuery → true', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([{ query: '{ hero }' }, { extensions: APQ_EXTENSIONS }]),
        },
      },
    })
    expect(hasPersistedQuery(entry)).toBe(true)
  })
})

describe('isGraphQLEntry — APQ', () => {
  it('POST with only extensions.persistedQuery (no query) → true', () => {
    expect(isGraphQLEntry(makeApqEntry())).toBe(true)
  })

  it('POST with query + extensions.persistedQuery → true', () => {
    const entry = makeApqEntry({
      postData: {
        text: JSON.stringify({ query: '{ hero }', extensions: APQ_EXTENSIONS }),
      },
    })
    expect(isGraphQLEntry(entry)).toBe(true)
  })

  it('GET with only extensions param containing persistedQuery → true', () => {
    const extensions = encodeURIComponent(JSON.stringify(APQ_EXTENSIONS))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?extensions=${extensions}`,
        headers: [],
      },
    })
    expect(isGraphQLEntry(entry)).toBe(true)
  })

  it('batch where items have APQ extensions instead of query → true', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([{ extensions: APQ_EXTENSIONS }, { query: '{ hero }' }]),
        },
      },
    })
    expect(isGraphQLEntry(entry)).toBe(true)
  })
})

describe('extractOperationInfo — APQ', () => {
  it('POST hash-only → returns sha256Hash as operationName, query type', () => {
    expect(extractOperationInfo(makeApqEntry())).toEqual({
      operationName: APQ_HASH,
      operationType: 'query',
    })
  })

  it('POST with query + APQ → uses parsed query name (not hash)', () => {
    const entry = makeApqEntry({
      postData: {
        text: JSON.stringify({
          query: 'query GetHero { hero { name } }',
          extensions: APQ_EXTENSIONS,
        }),
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: 'GetHero',
      operationType: 'query',
    })
  })

  it('GET hash-only → returns sha256Hash as operationName', () => {
    const extensions = encodeURIComponent(JSON.stringify(APQ_EXTENSIONS))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?extensions=${extensions}`,
        headers: [],
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: APQ_HASH,
      operationType: 'query',
    })
  })

  it('batch with hash-only first item → uses hash as name, batch type', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([{ extensions: APQ_EXTENSIONS }, { query: '{ hero }' }]),
        },
      },
    })
    expect(extractOperationInfo(entry)).toEqual({
      operationName: APQ_HASH,
      operationType: 'batch',
    })
  })
})

describe('extractQueryAndVariables — APQ', () => {
  it('POST hash-only → empty query, extensions populated', () => {
    const result = extractQueryAndVariables(makeApqEntry())
    expect(result.query).toBe('')
    expect(result.extensions).toBe(JSON.stringify(APQ_EXTENSIONS, null, 2))
  })

  it('POST hash-only with variables → empty query, variables and extensions populated', () => {
    const entry = makeApqEntry({
      postData: {
        text: JSON.stringify({
          variables: { id: '1' },
          extensions: APQ_EXTENSIONS,
        }),
      },
    })
    const result = extractQueryAndVariables(entry)
    expect(result.query).toBe('')
    expect(result.variables).toBe('{\n  "id": "1"\n}')
    expect(result.extensions).toBe(JSON.stringify(APQ_EXTENSIONS, null, 2))
  })

  it('GET hash-only → empty query, extensions populated', () => {
    const extensions = encodeURIComponent(JSON.stringify(APQ_EXTENSIONS))
    const entry = makeEntry({
      request: {
        method: 'GET',
        url: `https://example.com/graphql?extensions=${extensions}`,
        headers: [],
      },
    })
    const result = extractQueryAndVariables(entry)
    expect(result.query).toBe('')
    expect(result.extensions).toBe(JSON.stringify(APQ_EXTENSIONS, null, 2))
  })
})

describe('extractBatchedOperations — APQ', () => {
  it('sets persisted on items with persistedQuery extension', () => {
    const entry = makeEntry({
      request: {
        method: 'POST',
        url: 'https://example.com/graphql',
        headers: [{ name: 'content-type', value: 'application/json' }],
        postData: {
          text: JSON.stringify([{ query: '{ hero }' }, { extensions: APQ_EXTENSIONS }]),
        },
      },
    })
    const ops = extractBatchedOperations(entry, undefined)
    expect(ops[0].persisted).toBeUndefined()
    expect(ops[1].persisted).toBe(true)
    expect(ops[1].operationName).toBe(APQ_HASH)
    expect(ops[1].query).toBe('')
  })
})

describe('buildCurlCommand — APQ', () => {
  it('hash-only request → body has extensions but no query key', () => {
    const request: GraphQLRequest = {
      id: '1',
      operationName: APQ_HASH,
      operationType: 'query',
      status: 200,
      size: 512,
      time: 123,
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: [{ name: 'content-type', value: 'application/json' }],
      query: '',
      extensions: JSON.stringify(APQ_EXTENSIONS),
      persisted: true,
    }
    const cmd = buildCurlCommand(request)
    expect(cmd).toContain(`--data-raw '{"extensions":${JSON.stringify(APQ_EXTENSIONS)}}'`)
    expect(cmd).not.toContain('"query"')
  })
})
