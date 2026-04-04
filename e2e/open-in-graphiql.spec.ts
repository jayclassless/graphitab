import type { Page } from '@playwright/test'

import { test, expect } from './fixtures'

// ---------------------------------------------------------------------------
// Fake HAR entries
// ---------------------------------------------------------------------------

const POST_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify({
        operationName: 'GetItems',
        query: 'query GetItems { items { id name } }',
      }),
    },
  },
  response: {
    status: 200,
    content: { size: 128 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 50,
  responseContent: JSON.stringify({ data: { items: [] } }),
}

const GET_ENTRY = {
  request: {
    method: 'GET',
    url: 'https://example.com/graphql?query=query%20GetItems%20%7B%20items%20%7B%20id%20%7D%20%7D&operationName=GetItems',
    headers: [{ name: 'accept', value: 'application/json' }],
  },
  response: {
    status: 200,
    content: { size: 64 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 30,
  responseContent: JSON.stringify({ data: { items: [] } }),
}

const MATCHING_PROFILE_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://countries.trevorblades.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify({
        operationName: 'GetCountries',
        query: 'query GetCountries { countries { name } }',
      }),
    },
  },
  response: {
    status: 200,
    content: { size: 256 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 100,
  responseContent: JSON.stringify({ data: { countries: [] } }),
}

const BATCH_ENTRY = {
  request: {
    method: 'POST',
    url: 'https://example.com/graphql',
    headers: [{ name: 'content-type', value: 'application/json' }],
    postData: {
      text: JSON.stringify([
        { operationName: 'GetA', query: 'query GetA { a }' },
        { operationName: 'GetB', query: 'query GetB { b }' },
      ]),
    },
  },
  response: {
    status: 200,
    content: { size: 128 },
    headers: [{ name: 'content-type', value: 'application/json' }],
  },
  time: 80,
  responseContent: JSON.stringify([{ data: { a: 1 } }, { data: { b: 2 } }]),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function addRequest(page: Page, data: unknown) {
  await page.evaluate((d) => (window as any).__addGraphQLRequest(d), data)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Open in GraphiQL', () => {
  test('context menu shows "Open in GraphiQL" for a normal request', async ({
    devtoolsPanel: page,
  }) => {
    await addRequest(page, POST_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Open in GraphiQL' })).toBeVisible()
  })

  test('context menu does not show "Open in GraphiQL" for a batch request', async ({
    devtoolsPanel: page,
  }) => {
    await addRequest(page, BATCH_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Open in GraphiQL' })).not.toBeVisible()
  })

  test('shows the profile name prompt when no profile matches the URL', async ({
    devtoolsPanel: page,
  }) => {
    await addRequest(page, POST_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open in GraphiQL' }).click()
    await expect(page.locator('.gt-profile-prompt')).toBeVisible()
    await expect(page.locator('.gt-profile-prompt-url')).toHaveText('https://example.com/graphql')
  })

  test('profile prompt strips GraphQL params from a GET request URL', async ({
    devtoolsPanel: page,
  }) => {
    await addRequest(page, GET_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open in GraphiQL' }).click()
    await expect(page.locator('.gt-profile-prompt-url')).toHaveText('https://example.com/graphql')
  })

  test('cancelling the profile prompt dismisses it without creating a profile', async ({
    devtoolsPanel: page,
  }) => {
    await addRequest(page, POST_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open in GraphiQL' }).click()
    await expect(page.locator('.gt-profile-prompt')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.gt-profile-prompt')).not.toBeVisible()
  })

  test('submitting the profile prompt creates a profile and opens GraphiQL', async ({
    context,
    devtoolsPanel: page,
  }) => {
    await addRequest(page, POST_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Open in GraphiQL' }).click()
    await expect(page.locator('.gt-profile-prompt')).toBeVisible()

    await page.getByPlaceholder('Profile name...').fill('Test API')
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Create & Open' }).click(),
    ])

    await expect(page.locator('.gt-profile-prompt')).not.toBeVisible()
    await newPage.waitForLoadState()
    await expect(newPage).toHaveTitle('Test API - GraphiTab', { timeout: 15_000 })
  })

  test('opens GraphiQL directly when a matching profile exists', async ({
    context,
    devtoolsPanel: page,
  }) => {
    await addRequest(page, MATCHING_PROFILE_ENTRY)
    await page.locator('.gt-network-row').click({ button: 'right' })

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('menuitem', { name: 'Open in GraphiQL' }).click(),
    ])

    // Should open GraphiQL with the matching "Countries" default profile
    await newPage.waitForLoadState()
    await expect(newPage).toHaveTitle('Countries - GraphiTab', { timeout: 15_000 })
  })
})
