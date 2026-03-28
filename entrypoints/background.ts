import type { BackgroundFetchMessage, BackgroundFetchResponse } from '~/utils/background_fetch'

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: BackgroundFetchMessage, _sender, sendResponse) => {
      if (message.type !== 'fetch') return

      fetch(message.url, {
        method: message.init.method,
        headers: message.init.headers,
        body: message.init.body,
      })
        .then(async (response) => {
          const headers: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            headers[key] = value
          })

          const result: BackgroundFetchResponse = {
            status: response.status,
            statusText: response.statusText,
            headers,
            body: await response.text(),
          }
          sendResponse(result)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown fetch error'
          sendResponse({ error: message })
        })

      return true // keep the message channel open for async sendResponse
    }
  )
})
