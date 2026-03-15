import path from 'path'

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
  devtoolsPanel: Page
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture convention
  context: async ({}, use) => {
    const pathToExtension = path.join(import.meta.dirname, '..', '.output', 'chrome-mv3')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker')
    }
    const extensionId = serviceWorker.url().split('/')[2]
    await use(extensionId)
  },
  devtoolsPanel: async ({ page, extensionId }, use) => {
    await page.addInitScript(`
      (function () {
        localStorage.clear();
        var requestListeners = [];
        var navigatedListeners = [];

        window.__addGraphQLRequest = function (data) {
          var entry = {
            request: data.request,
            response: data.response,
            time: data.time,
            getContent: function (cb) { cb(data.responseContent || '', ''); }
          };
          return Promise.all(requestListeners.map(function (l) { return l(entry); }));
        };

        window.__triggerNavigated = function () {
          navigatedListeners.forEach(function (l) { l(); });
        };

        window.chrome.devtools = {
          network: {
            onRequestFinished: {
              addListener: function (cb) { requestListeners.push(cb); },
              removeListener: function (cb) {
                requestListeners = requestListeners.filter(function (l) { return l !== cb; });
              }
            },
            onNavigated: {
              addListener: function (cb) { navigatedListeners.push(cb); },
              removeListener: function (cb) {
                navigatedListeners = navigatedListeners.filter(function (l) { return l !== cb; });
              }
            }
          },
          inspectedWindow: { tabId: 1 }
        };
      })();
    `)
    await page.goto(`chrome-extension://${extensionId}/devtools-panel.html`)
    await page.waitForSelector('.gt-devtools-panel')
    await use(page)
  },
})

export const expect = test.expect
