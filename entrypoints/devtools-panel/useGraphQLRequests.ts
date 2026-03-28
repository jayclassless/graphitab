import { useState, useEffect, useCallback } from 'react'
import { browser } from 'wxt/browser'

import {
  isGraphQLEntry,
  extractOperationInfo,
  extractQueryAndVariables,
  extractBatchedOperations,
  hasPersistedQuery,
} from './har'
import type { HAREntry, GraphQLRequest } from './har'

export function useGraphQLRequests(autoClear: boolean): {
  requests: GraphQLRequest[]
  clear: () => void
} {
  const [requests, setRequests] = useState<GraphQLRequest[]>([])

  const clear = useCallback(() => setRequests([]), [])

  useEffect(() => {
    let counter = 0
    async function handleRequest(entry: HAREntry) {
      if (!isGraphQLEntry(entry)) return
      const { operationName, operationType } = extractOperationInfo(entry)
      const { query, variables, extensions } = extractQueryAndVariables(entry)
      const persisted = hasPersistedQuery(entry) || undefined
      const responseText = await new Promise<string>((resolve) => {
        entry.getContent((content, encoding) => {
          if (encoding === 'base64') {
            try {
              resolve(atob(content))
            } catch {
              resolve(content)
            }
          } else {
            resolve(content)
          }
        })
      })
      const batchedOperations =
        operationType === 'batch'
          ? extractBatchedOperations(entry, responseText || undefined)
          : undefined
      setRequests((prev) => [
        ...prev,
        {
          id: String(++counter),
          operationName,
          operationType,
          status: entry.response.status,
          size: entry.response.content.size,
          time: entry.time,
          url: entry.request.url,
          method: entry.request.method,
          headers: entry.request.headers,
          query,
          variables,
          extensions,
          rawBody: entry.request.postData?.text || undefined,
          response: responseText || undefined,
          responseHeaders: entry.response.headers,
          batchedOperations,
          persisted,
        },
      ])
    }
    browser.devtools.network.onRequestFinished.addListener(handleRequest)
    return () => {
      browser.devtools.network.onRequestFinished.removeListener(handleRequest)
    }
  }, [])

  useEffect(() => {
    if (!autoClear) return
    function handleNavigated() {
      setRequests([])
    }
    browser.devtools.network.onNavigated.addListener(handleNavigated)
    return () => browser.devtools.network.onNavigated.removeListener(handleNavigated)
  }, [autoClear])

  return { requests, clear }
}
