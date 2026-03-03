import { useState, useEffect, useCallback } from 'react'

import { isGraphQLEntry, extractOperationInfo, extractQueryAndVariables } from './har'
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
      const { query, variables } = extractQueryAndVariables(entry)
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
          response: responseText || undefined,
          responseHeaders: entry.response.headers,
        },
      ])
    }
    chrome.devtools.network.onRequestFinished.addListener(handleRequest)
    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(handleRequest)
    }
  }, [])

  useEffect(() => {
    if (!autoClear) return
    function handleNavigated() {
      setRequests([])
    }
    chrome.devtools.network.onNavigated.addListener(handleNavigated)
    return () => chrome.devtools.network.onNavigated.removeListener(handleNavigated)
  }, [autoClear])

  return { requests, clear }
}
