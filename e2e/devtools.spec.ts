import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'

// ---------------------------------------------------------------------------
// Fake HAR entries – synthetic GraphQL requests used to populate the panel
// ---------------------------------------------------------------------------

const QUERY_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [
      { name: 'content-type', value: 'application/json' },
      { name: 'accept', value: 'application/json' },
    ],
    postData: {
      text: JSON.stringify({
        operationName: 'GetItems',
        query: 'query GetItems { items { id name } }',
      }),
    },
  },
  response: {
    status: 200,
    content: { size: 512 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 150,
  responseContent: JSON.stringify({ data: { items: [{ id: '1', name: 'Item One' }] } }),
}

const MUTATION_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify({
        operationName: 'CreateItem',
        query: 'mutation CreateItem($name: String!) { createItem(name: $name) { id } }',
        variables: { name: 'Test Item' },
      }),
    },
  },
  response: {
    status: 200,
    content: { size: 256 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 80,
  responseContent: JSON.stringify({ data: { createItem: { id: '2' } } }),
}

const ERROR_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify({
        operationName: 'FailQuery',
        query: 'query FailQuery { fail }',
      }),
    },
  },
  response: {
    status: 500,
    content: { size: 64 },
    headers: [],
  },
  time: 10,
  responseContent: JSON.stringify({ errors: [{ message: 'Internal Server Error' }] }),
}

const BATCH_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify([
        { operationName: 'GetItems', query: 'query GetItems { items { id name } }' },
        { operationName: 'GetOther', query: 'query GetOther { other { id } }' },
      ]),
    },
  },
  response: {
    status: 200,
    content: { size: 1024 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 200,
  responseContent: JSON.stringify([
    { data: { items: [{ id: '1', name: 'Item One' }] } },
    { data: { other: [{ id: '2' }] } },
  ]),
}

const JWT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaXNzIjoiYXV0aC5leGFtcGxlLmNvbSIsImV4cCI6MTczNTY4OTYwMCwiaWF0IjoxNzM1NjAzMjAwLCJjdXN0b21fY2xhaW0iOiJ0ZXN0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const JWT_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [
      { name: 'content-type', value: 'application/json' },
      { name: 'authorization', value: `Bearer ${JWT_TOKEN}` },
    ],
    postData: {
      text: JSON.stringify({
        operationName: 'GetUser',
        query: 'query GetUser { me { id name } }',
      }),
    },
  },
  response: {
    status: 200,
    content: { size: 128 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 100,
  responseContent: JSON.stringify({ data: { me: { id: '1', name: 'John' } } }),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addRequest(page: Page, data: unknown) {
  await page.evaluate((d) => (window as any).__addGraphQLRequest(d), data)
}

async function triggerNavigated(page: Page) {
  await page.evaluate(() => (window as any).__triggerNavigated())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('DevTools Panel', () => {
  test.describe('Empty state', () => {
    test('shows "No GraphQL requests recorded." by default', async ({ devtoolsPanel: page }) => {
      await expect(page.locator('.gt-network-empty')).toContainText('No GraphQL requests recorded.')
    })
  })

  test.describe('Request list', () => {
    test('shows a query request with operation name and Q badge', async ({
      devtoolsPanel: page,
    }) => {
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-network-row')).toBeVisible()
      await expect(page.locator('.gt-op-badge--query')).toBeVisible()
      await expect(page.locator('.gt-network-row')).toContainText('GetItems')
    })

    test('shows a mutation request with M badge', async ({ devtoolsPanel: page }) => {
      await addRequest(page, MUTATION_ENTRY)
      await expect(page.locator('.gt-op-badge--mutation')).toBeVisible()
      await expect(page.locator('.gt-network-row')).toContainText('CreateItem')
    })

    test('shows a batch request with B badge', async ({ devtoolsPanel: page }) => {
      await addRequest(page, BATCH_ENTRY)
      await expect(page.locator('.gt-op-badge--batch')).toBeVisible()
    })

    test('shows a success status indicator for 2xx responses', async ({ devtoolsPanel: page }) => {
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-status-dot--success')).toBeVisible()
    })

    test('shows an error status indicator for 5xx responses', async ({ devtoolsPanel: page }) => {
      await addRequest(page, ERROR_ENTRY)
      await expect(page.locator('.gt-status-dot--error')).toBeVisible()
    })
  })

  test.describe('Clear button', () => {
    test('removes all requests and shows the empty state', async ({ devtoolsPanel: page }) => {
      await addRequest(page, QUERY_ENTRY)
      await addRequest(page, MUTATION_ENTRY)
      await expect(page.locator('.gt-network-row')).toHaveCount(2)
      await page.locator('.gt-clear-btn').click()
      await expect(page.locator('.gt-network-empty')).toBeVisible()
    })
  })

  test.describe('Type filters', () => {
    test.beforeEach(async ({ devtoolsPanel: page }) => {
      await addRequest(page, QUERY_ENTRY)
      await addRequest(page, MUTATION_ENTRY)
      await expect(page.locator('.gt-network-row')).toHaveCount(2)
    })

    test('toggling off Query hides query requests', async ({ devtoolsPanel: page }) => {
      await page.getByRole('button', { name: 'Query' }).click()
      await expect(page.locator('.gt-network-row')).toHaveCount(1)
      await expect(page.locator('.gt-op-badge--mutation')).toBeVisible()
    })

    test('re-enabling Query restores query requests', async ({ devtoolsPanel: page }) => {
      await page.getByRole('button', { name: 'Query' }).click()
      await expect(page.locator('.gt-network-row')).toHaveCount(1)
      await page.getByRole('button', { name: 'Query' }).click()
      await expect(page.locator('.gt-network-row')).toHaveCount(2)
    })

    test('toggling off Mutation hides mutation requests', async ({ devtoolsPanel: page }) => {
      await page.getByRole('button', { name: 'Mutation' }).click()
      await expect(page.locator('.gt-network-row')).toHaveCount(1)
      await expect(page.locator('.gt-op-badge--query')).toBeVisible()
    })
  })

  test.describe('Request modal', () => {
    test.beforeEach(async ({ devtoolsPanel: page }) => {
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-network-row')).toBeVisible()
    })

    test('clicking a row opens the modal', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-backdrop')).toBeVisible()
    })

    test('modal shows the operation name', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-title')).toContainText('GetItems')
    })

    test('modal meta shows the request URL', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-meta-url')).toContainText('https://example.com/graphql')
    })

    test('Headers tab shows request headers', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      // Headers is the default tab
      await expect(page.locator('.gt-modal-headers')).toContainText('content-type')
    })

    test('Request tab shows the query', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await page.getByRole('tab', { name: 'Request' }).click()
      await expect(page.locator('.gt-query-block')).toContainText('GetItems')
    })

    test('Response tab shows the response data', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await page.getByRole('tab', { name: 'Response' }).click()
      await expect(page.locator('.gt-modal-content')).toContainText('Item One')
    })

    test('Escape key closes the modal', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-backdrop')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.gt-modal-backdrop')).not.toBeVisible()
    })

    test('close button closes the modal', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-network-row').click()
      await page.locator('.gt-modal-close').click()
      await expect(page.locator('.gt-modal-backdrop')).not.toBeVisible()
    })

    test('next/prev buttons navigate between requests', async ({ devtoolsPanel: page }) => {
      await addRequest(page, MUTATION_ENTRY)
      await expect(page.locator('.gt-network-row')).toHaveCount(2)

      await page.locator('.gt-network-row').first().click()
      await expect(page.locator('.gt-modal-title')).toContainText('GetItems')

      await page.getByLabel('Next request').click()
      await expect(page.locator('.gt-modal-title')).toContainText('CreateItem')

      await page.getByLabel('Previous request').click()
      await expect(page.locator('.gt-modal-title')).toContainText('GetItems')
    })
  })

  test.describe('Preserve log', () => {
    test('clears requests on navigation when preserve log is off', async ({
      devtoolsPanel: page,
    }) => {
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-network-row')).toBeVisible()
      await triggerNavigated(page)
      await expect(page.locator('.gt-network-empty')).toBeVisible()
    })

    test('keeps requests on navigation when preserve log is on', async ({
      devtoolsPanel: page,
    }) => {
      await page.locator('.gt-toolbar-label input[type="checkbox"]').check()
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-network-row')).toBeVisible()
      await triggerNavigated(page)
      await expect(page.locator('.gt-network-row')).toBeVisible()
    })
  })

  test.describe('Context menu', () => {
    test('right-clicking a row shows the context menu with copy actions', async ({
      devtoolsPanel: page,
    }) => {
      await addRequest(page, QUERY_ENTRY)
      await expect(page.locator('.gt-network-row')).toBeVisible()
      await page.locator('.gt-network-row').click({ button: 'right' })
      await expect(page.locator('.gt-context-menu')).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Copy URL' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Copy Query' })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Copy as cURL' })).toBeVisible()
    })
  })

  test.describe('Batch requests', () => {
    test('batch modal shows operation selector with both operations', async ({
      devtoolsPanel: page,
    }) => {
      await addRequest(page, BATCH_ENTRY)
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-batch-nav')).toBeVisible()
      const select = page.locator('.gt-modal-title-select')
      await expect(select).toBeVisible()
      await expect(select.locator('option')).toHaveCount(2)
    })

    test('batch modal prev/next buttons navigate between operations', async ({
      devtoolsPanel: page,
    }) => {
      await addRequest(page, BATCH_ENTRY)
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-title-select')).toHaveValue('0')

      await page.getByLabel('Next operation').click()
      await expect(page.locator('.gt-modal-title-select')).toHaveValue('1')

      await page.getByLabel('Previous operation').click()
      await expect(page.locator('.gt-modal-title-select')).toHaveValue('0')
    })
  })

  test.describe('JWT viewer', () => {
    test.beforeEach(async ({ devtoolsPanel: page }) => {
      await addRequest(page, JWT_ENTRY)
      await page.locator('.gt-network-row').click()
      await expect(page.locator('.gt-modal-backdrop')).toBeVisible()
    })

    test('JWT header value is rendered as a clickable link', async ({ devtoolsPanel: page }) => {
      const jwtLink = page.locator('.gt-jwt-link')
      await expect(jwtLink).toBeVisible()
      await expect(jwtLink).toContainText('Bearer')
    })

    test('clicking the JWT link opens the JWT modal', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      await expect(page.locator('.gt-jwt-modal-backdrop')).toBeVisible()
      await expect(page.locator('.gt-jwt-modal-title')).toContainText('JWT Claims')
    })

    test('JWT modal shows decoded header claims', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      const headerSection = page.locator('.gt-jwt-section').first()
      await expect(headerSection.locator('.gt-jwt-section-title')).toContainText('Header')
      await expect(headerSection).toContainText('alg')
      await expect(headerSection).toContainText('HS256')
      await expect(headerSection).toContainText('typ')
      await expect(headerSection).toContainText('JWT')
    })

    test('JWT modal shows decoded payload claims', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      const payloadSection = page.locator('.gt-jwt-section').nth(1)
      await expect(payloadSection.locator('.gt-jwt-section-title')).toContainText('Payload')
      await expect(payloadSection).toContainText('sub')
      await expect(payloadSection).toContainText('1234567890')
      await expect(payloadSection).toContainText('name')
      await expect(payloadSection).toContainText('John Doe')
      await expect(payloadSection).toContainText('iss')
      await expect(payloadSection).toContainText('auth.example.com')
    })

    test('known claims have a tooltip with description', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      const issCell = page.locator('.gt-jwt-claim-name--known', { hasText: 'iss' })
      await expect(issCell).toHaveAttribute('title', 'Issuer')
    })

    test('unknown claims do not have a tooltip', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      const customCell = page.locator('.gt-jwt-claims-table td', { hasText: 'custom_claim' })
      await expect(customCell).not.toHaveClass(/gt-jwt-claim-name--known/)
      await expect(customCell).not.toHaveAttribute('title')
    })

    test('copy header JSON button is present', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      await expect(page.getByTitle('Copy header JSON')).toBeVisible()
    })

    test('copy payload JSON button is present', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      await expect(page.getByTitle('Copy payload JSON')).toBeVisible()
    })

    test('Escape closes only the JWT modal, not the request modal', async ({
      devtoolsPanel: page,
    }) => {
      await page.locator('.gt-jwt-link').click()
      await expect(page.locator('.gt-jwt-modal-backdrop')).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(page.locator('.gt-jwt-modal-backdrop')).not.toBeVisible()
      await expect(page.locator('.gt-modal-backdrop')).toBeVisible()
    })

    test('clicking the JWT modal backdrop closes it', async ({ devtoolsPanel: page }) => {
      await page.locator('.gt-jwt-link').click()
      await expect(page.locator('.gt-jwt-modal-backdrop')).toBeVisible()

      await page.locator('.gt-jwt-modal-backdrop').click({ position: { x: 5, y: 5 } })
      await expect(page.locator('.gt-jwt-modal-backdrop')).not.toBeVisible()
      await expect(page.locator('.gt-modal-backdrop')).toBeVisible()
    })

    test('non-JWT header values are not clickable', async ({ devtoolsPanel: page }) => {
      const contentTypeCell = page.locator('.gt-headers-table td', { hasText: 'application/json' })
      await expect(contentTypeCell.locator('.gt-jwt-link')).toHaveCount(0)
    })
  })
})
