import { browser } from '#imports'

export type BackgroundFetchMessage = {
  type: 'fetch'
  url: string
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
}

export type BackgroundFetchResponse =
  | {
      status: number
      statusText: string
      headers: Record<string, string>
      body: string
    }
  | {
      error: string
    }

/**
 * A fetch implementation that proxies requests through the background script
 * to avoid CORS restrictions on extension pages (needed for Firefox).
 */
export const backgroundFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init)

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  const message: BackgroundFetchMessage = {
    type: 'fetch',
    url: request.url,
    init: {
      method: request.method,
      headers,
      body: init?.body as string | undefined,
    },
  }

  const response: BackgroundFetchResponse = await browser.runtime.sendMessage(message)

  if (!response) {
    throw new TypeError('Failed to fetch (no response from background script)')
  }

  if ('error' in response) {
    throw new TypeError(response.error)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
