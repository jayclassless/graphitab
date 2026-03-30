import type { BackgroundFetchMessage, BackgroundFetchResponse } from '~/utils/background_fetch'

type BackgroundMessage = BackgroundFetchMessage

export async function handleFetch(
  message: BackgroundFetchMessage
): Promise<BackgroundFetchResponse> {
  try {
    const response = await fetch(message.url, {
      method: message.init.method,
      headers: message.init.headers,
      body: message.init.body,
    })

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body: await response.text(),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error'
    return { error: errorMessage }
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'fetch':
        handleFetch(message).then(sendResponse)
        return true // keep the message channel open for async sendResponse
    }
  })
})
