import { useState, useEffect, useCallback } from 'react'

import { isGraphQLEntry, extractOperationInfo } from './har'
import type { HAREntry, GraphQLRequest } from './har'

export function useGraphQLRequests(autoClear: boolean): {
  requests: GraphQLRequest[]
  clear: () => void
} {
  const [requests, setRequests] = useState<GraphQLRequest[]>([])

  const clear = useCallback(() => setRequests([]), [])

  useEffect(() => {
    let counter = 0
    function handleRequest(entry: HAREntry) {
      if (!isGraphQLEntry(entry)) return
      const { operationName, operationType } = extractOperationInfo(entry)
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
