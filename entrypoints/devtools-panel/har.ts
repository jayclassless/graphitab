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
  }
  time: number
}

export type GraphQLRequest = {
  id: string
  operationName: string
  status: number
  size: number
  time: number
  url: string
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

export function extractOperationName(entry: HAREntry): string {
  const { method, url, postData } = entry.request

  if (method === 'POST' && postData?.text) {
    try {
      const body = JSON.parse(postData.text)
      if (typeof body.operationName === 'string' && body.operationName.trim()) {
        return body.operationName.trim()
      }
      if (typeof body.query === 'string') {
        return nameFromQuery(body.query)
      }
    } catch {
      // fall through
    }
  }

  if (method === 'GET') {
    try {
      const params = new URL(url).searchParams
      const opName = params.get('operationName')
      if (opName?.trim()) return opName.trim()
      const query = params.get('query')
      if (query) return nameFromQuery(query)
    } catch {
      // fall through
    }
  }

  return 'Anonymous'
}

function nameFromQuery(query: string): string {
  try {
    const ast = parse(query)
    const op = ast.definitions.find(
      (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition'
    )
    if (op?.name?.value) return op.name.value
    if (op?.operation) {
      const t = op.operation
      return t.charAt(0).toUpperCase() + t.slice(1)
    }
  } catch {
    // fall through
  }
  return 'Anonymous'
}
