import { parse, OperationDefinitionNode } from 'graphql'

export type HAREntry = {
  request: {
    method: string
    url: string
    headers: Array<{ name: string; value: string }>
    postData?: { text?: string }
  }
  response: {
    status: number
    content: { size: number }
    headers?: Array<{ name: string; value: string }>
  }
  time: number
  getContent(callback: (content: string, encoding: string) => void): void
}

export type OperationType = 'query' | 'mutation' | 'subscription' | 'unknown'

export type GraphQLRequest = {
  id: string
  operationName: string
  operationType: OperationType
  status: number
  size: number
  time: number
  url: string
  method: string
  headers: Array<{ name: string; value: string }>
  query: string
  variables?: string
  response?: string
  responseHeaders?: Array<{ name: string; value: string }>
}

export function isGraphQLEntry(entry: HAREntry): boolean {
  const { method, url, headers, postData } = entry.request

  if (method === 'POST') {
    const contentType = headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? ''
    if (!contentType.includes('application/json')) return false
    if (!postData?.text) return false
    try {
      const body = JSON.parse(postData.text)
      return typeof body.query === 'string'
    } catch {
      return false
    }
  }

  if (method === 'GET') {
    try {
      return new URL(url).searchParams.has('query')
    } catch {
      return false
    }
  }

  return false
}

export type QueryAndVariables = {
  query: string
  variables?: string
}

export function extractQueryAndVariables(entry: HAREntry): QueryAndVariables {
  const { method, url, postData } = entry.request

  if (method === 'POST' && postData?.text) {
    try {
      const body = JSON.parse(postData.text)
      if (typeof body.query === 'string') {
        const variables =
          body.variables !== null && typeof body.variables === 'object'
            ? JSON.stringify(body.variables, null, 2)
            : undefined
        return { query: body.query, variables }
      }
    } catch {
      // fall through
    }
  }

  if (method === 'GET') {
    try {
      const params = new URL(url).searchParams
      const query = params.get('query')
      if (query) {
        const variablesParam = params.get('variables')
        let variables: string | undefined
        if (variablesParam) {
          try {
            variables = JSON.stringify(JSON.parse(variablesParam), null, 2)
          } catch {
            // not valid JSON, skip
          }
        }
        return { query, variables }
      }
    } catch {
      // fall through
    }
  }

  return { query: '' }
}

export type OperationInfo = {
  operationName: string
  operationType: OperationType
}

export function extractOperationInfo(entry: HAREntry): OperationInfo {
  const { method, url, postData } = entry.request

  if (method === 'POST' && postData?.text) {
    try {
      const body = JSON.parse(postData.text)
      if (typeof body.query === 'string') {
        const info = parseOperation(body.query)
        if (typeof body.operationName === 'string' && body.operationName.trim()) {
          return { operationName: body.operationName.trim(), operationType: info.operationType }
        }
        return info
      }
    } catch {
      // fall through
    }
  }

  if (method === 'GET') {
    try {
      const params = new URL(url).searchParams
      const query = params.get('query')
      if (query) {
        const info = parseOperation(query)
        const opName = params.get('operationName')
        if (opName?.trim()) {
          return { operationName: opName.trim(), operationType: info.operationType }
        }
        return info
      }
    } catch {
      // fall through
    }
  }

  return { operationName: 'Anonymous', operationType: 'unknown' }
}

function parseOperation(query: string): OperationInfo {
  try {
    const ast = parse(query)
    const op = ast.definitions.find(
      (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition'
    )
    if (op) {
      const operationType = op.operation
      const operationName =
        op.name?.value ?? op.operation.charAt(0).toUpperCase() + op.operation.slice(1)
      return { operationName, operationType }
    }
  } catch {
    // fall through
  }
  return { operationName: 'Anonymous', operationType: 'unknown' }
}

const SKIPPED_HEADERS = new Set(['content-length'])
const SKIPPED_HEADER_PREFIXES = [':', 'sec-']

function shellEscape(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'"
}

export function buildCurlCommand(request: GraphQLRequest): string {
  const parts = ['curl', `-X ${request.method.toUpperCase()}`, shellEscape(request.url)]

  for (const { name, value } of request.headers) {
    const lower = name.toLowerCase()
    if (SKIPPED_HEADERS.has(lower) || SKIPPED_HEADER_PREFIXES.some((p) => lower.startsWith(p))) {
      continue
    }
    parts.push(`-H ${shellEscape(`${name}: ${value}`)}`)
  }

  if (request.method.toUpperCase() === 'POST') {
    const body: Record<string, unknown> = { query: request.query }
    if (request.variables) {
      try {
        body.variables = JSON.parse(request.variables)
      } catch {
        // variables couldn't be parsed; omit from body
      }
    }
    parts.push(`--data-raw ${shellEscape(JSON.stringify(body))}`)
  }

  return parts.join(' ')
}
