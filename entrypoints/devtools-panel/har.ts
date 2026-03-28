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

export type OperationType = 'query' | 'mutation' | 'subscription' | 'unknown' | 'batch'

export type BatchedOperation = {
  operationName: string
  operationType: Exclude<OperationType, 'batch'>
  query: string
  variables?: string
  extensions?: string
  response?: string
  persisted?: boolean
}

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
  extensions?: string
  rawBody?: string
  response?: string
  responseHeaders?: Array<{ name: string; value: string }>
  batchedOperations?: BatchedOperation[]
  persisted?: boolean
}

export type NavigationDivider = {
  kind: 'navigation-divider'
  id: string
  url: string
}

export type TableEntry = GraphQLRequest | NavigationDivider

export function isNavigationDivider(entry: TableEntry): entry is NavigationDivider {
  return 'kind' in entry && entry.kind === 'navigation-divider'
}

function hasPersistedQueryExtension(extensions: unknown): boolean {
  return (
    typeof extensions === 'object' &&
    extensions !== null &&
    typeof (extensions as Record<string, unknown>).persistedQuery === 'object' &&
    (extensions as Record<string, unknown>).persistedQuery !== null &&
    typeof (extensions as Record<string, Record<string, unknown>>).persistedQuery.sha256Hash ===
      'string'
  )
}

function isGraphQLItem(item: Record<string, unknown>): boolean {
  return typeof item.query === 'string' || hasPersistedQueryExtension(item.extensions)
}

export function hasPersistedQuery(entry: HAREntry): boolean {
  const { method, url, postData } = entry.request

  if (method === 'POST' && postData?.text) {
    try {
      const body = JSON.parse(postData.text)
      if (Array.isArray(body))
        return body.some((item) => hasPersistedQueryExtension(item?.extensions))
      return hasPersistedQueryExtension(body.extensions)
    } catch {
      return false
    }
  }

  if (method === 'GET') {
    try {
      const extensionsParam = new URL(url).searchParams.get('extensions')
      if (extensionsParam) return hasPersistedQueryExtension(JSON.parse(extensionsParam))
    } catch {
      return false
    }
  }

  return false
}

export function isGraphQLEntry(entry: HAREntry): boolean {
  const { method, url, headers, postData } = entry.request

  if (method === 'POST') {
    const contentType = headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? ''
    if (!contentType.includes('application/json')) return false
    if (!postData?.text) return false
    try {
      const body = JSON.parse(postData.text)
      if (isGraphQLItem(body)) return true
      if (Array.isArray(body) && body.length > 0 && body.every((item) => isGraphQLItem(item)))
        return true
      return false
    } catch {
      return false
    }
  }

  if (method === 'GET') {
    try {
      const params = new URL(url).searchParams
      if (params.has('query')) return true
      const extensionsParam = params.get('extensions')
      if (extensionsParam) return hasPersistedQueryExtension(JSON.parse(extensionsParam))
      return false
    } catch {
      return false
    }
  }

  return false
}

export type QueryAndVariables = {
  query: string
  variables?: string
  extensions?: string
}

function extractPostBodyFields(body: Record<string, unknown>): QueryAndVariables {
  const query = typeof body.query === 'string' ? body.query : ''
  const variables =
    body.variables !== null && typeof body.variables === 'object'
      ? JSON.stringify(body.variables, null, 2)
      : undefined
  const extensions =
    body.extensions !== null && typeof body.extensions === 'object'
      ? JSON.stringify(body.extensions, null, 2)
      : undefined
  return { query, variables, extensions }
}

export function extractQueryAndVariables(entry: HAREntry): QueryAndVariables {
  const { method, url, postData } = entry.request

  if (method === 'POST' && postData?.text) {
    try {
      const body = JSON.parse(postData.text)
      if (typeof body.query === 'string' || hasPersistedQueryExtension(body.extensions)) {
        return extractPostBodyFields(body)
      }
    } catch {
      // fall through
    }
  }

  if (method === 'GET') {
    try {
      const params = new URL(url).searchParams
      const query = params.get('query')
      const extensionsParam = params.get('extensions')
      if (query || extensionsParam) {
        let variables: string | undefined
        const variablesParam = params.get('variables')
        if (variablesParam) {
          try {
            variables = JSON.stringify(JSON.parse(variablesParam), null, 2)
          } catch {
            // not valid JSON, skip
          }
        }
        let extensions: string | undefined
        if (extensionsParam) {
          try {
            extensions = JSON.stringify(JSON.parse(extensionsParam), null, 2)
          } catch {
            // not valid JSON, skip
          }
        }
        return { query: query ?? '', variables, extensions }
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

function operationInfoFromPersistedQuery(extensions: unknown): OperationInfo | null {
  if (!hasPersistedQueryExtension(extensions)) return null
  const hash = (extensions as Record<string, Record<string, string>>).persistedQuery.sha256Hash
  return { operationName: hash, operationType: 'query' }
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
      if (Array.isArray(body) && body.length > 0) {
        const first = body[0]
        const firstQuery = typeof first?.query === 'string' ? first.query : ''
        const info = firstQuery
          ? parseOperation(firstQuery)
          : (operationInfoFromPersistedQuery(first?.extensions) ?? parseOperation(''))
        const opName =
          typeof first?.operationName === 'string' && first.operationName.trim()
            ? first.operationName.trim()
            : info.operationName
        return { operationName: opName, operationType: 'batch' }
      }
      const apqInfo = operationInfoFromPersistedQuery(body.extensions)
      if (apqInfo) return apqInfo
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
      const extensionsParam = params.get('extensions')
      if (extensionsParam) {
        const apqInfo = operationInfoFromPersistedQuery(JSON.parse(extensionsParam))
        if (apqInfo) return apqInfo
      }
    } catch {
      // fall through
    }
  }

  return { operationName: 'Anonymous', operationType: 'unknown' }
}

export function extractBatchedOperations(
  entry: HAREntry,
  responseText: string | undefined
): BatchedOperation[] {
  const { postData } = entry.request
  if (!postData?.text) return []
  try {
    const body = JSON.parse(postData.text)
    if (!Array.isArray(body)) return []

    let responseArray: unknown[] | undefined
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText)
        if (Array.isArray(parsed)) responseArray = parsed
      } catch {
        // ignore malformed response
      }
    }

    return body.map((item, i) => {
      const itemQuery = typeof item?.query === 'string' ? item.query : ''
      const info = itemQuery
        ? parseOperation(itemQuery)
        : (operationInfoFromPersistedQuery(item?.extensions) ?? parseOperation(''))
      const opName =
        typeof item?.operationName === 'string' && item.operationName.trim()
          ? item.operationName.trim()
          : info.operationName
      const variables =
        item?.variables !== null && typeof item?.variables === 'object'
          ? JSON.stringify(item.variables, null, 2)
          : undefined
      const extensions =
        item?.extensions !== null && typeof item?.extensions === 'object'
          ? JSON.stringify(item.extensions, null, 2)
          : undefined
      const response =
        responseArray?.[i] !== undefined ? JSON.stringify(responseArray[i], null, 2) : undefined
      const persisted = hasPersistedQueryExtension(item?.extensions) || undefined
      return {
        operationName: opName,
        operationType: info.operationType as Exclude<OperationType, 'batch'>,
        query: itemQuery,
        variables,
        extensions,
        response,
        persisted,
      }
    })
  } catch {
    return []
  }
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
    if (request.rawBody) {
      parts.push(`--data-raw ${shellEscape(request.rawBody)}`)
    } else {
      const body: Record<string, unknown> = {}
      if (request.query) body.query = request.query
      if (request.variables) {
        try {
          body.variables = JSON.parse(request.variables)
        } catch {
          // variables couldn't be parsed; omit from body
        }
      }
      if (request.extensions) {
        try {
          body.extensions = JSON.parse(request.extensions)
        } catch {
          // extensions couldn't be parsed; omit from body
        }
      }
      parts.push(`--data-raw ${shellEscape(JSON.stringify(body))}`)
    }
  }

  return parts.join(' ')
}

export function parseJsonObject(str: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(str)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
    return null
  } catch {
    return null
  }
}
