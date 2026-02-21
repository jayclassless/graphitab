import { test, expect } from './fixtures'

test.describe('GraphiQL Page', () => {
  test('loads GraphiQL with a default profile', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page).toHaveTitle('Countries - GraphiTab')
  })

  test('shows "Profile not found" for invalid profile ID', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=nonexistent`)
    await expect(page.getByText('Profile not found')).toBeVisible()
  })

  test('shows "Profile not found" when no profile param', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html`)
    await expect(page.getByText('Profile not found')).toBeVisible()
  })

  test('can execute a query against the Countries API', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })

    // Focus the query editor's Monaco textarea and replace contents
    const queryEditor = page.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ countries { name } }', { delay: 10 })

    await page.locator('.graphiql-execute-button').click()

    await expect(page.locator('.graphiql-response')).toContainText('countries', {
      timeout: 10_000,
    })
  })

  test('Explorer plugin is available', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByLabel('Show GraphiQL Explorer')).toBeVisible()
  })

  test('Saved Queries plugin is available', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByLabel('Show Saved Queries')).toBeVisible()
  })
})

test.describe('Profile headers', () => {
  test('sends custom headers with GraphQL requests', async ({ page, extensionId }) => {
    // Create a profile with a custom header via the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.getByText('+ New Profile').click()
    await page.getByPlaceholder('Name').fill('Countries With Headers')
    await page
      .getByPlaceholder('GraphQL endpoint URL')
      .fill('https://countries.trevorblades.com/graphql')
    await page.getByText('+ Add Header').click()
    await page.getByPlaceholder('Header name').fill('X-Test-Header')
    await page.getByPlaceholder('Value').fill('e2e-test-value')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Countries With Headers')).toBeVisible()

    // Get the profile ID from the link href
    const href = await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'Countries With Headers' })
      .locator('a')
      .getAttribute('href')
    const profileId = new URLSearchParams(href!.split('?')[1]).get('profile')!

    // Navigate to GraphiQL for this profile
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=${profileId}`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })

    // Intercept the GraphQL request and capture headers
    const requestPromise = page.waitForRequest(
      (req) => req.url() === 'https://countries.trevorblades.com/graphql' && req.method() === 'POST'
    )

    // Type and execute a query
    const queryEditor = page.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ countries { name } }', { delay: 10 })
    await page.locator('.graphiql-execute-button').click()

    const request = await requestPromise
    expect(request.headers()['x-test-header']).toBe('e2e-test-value')
  })
})

test.describe('Saved Queries', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(page.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await page.getByLabel('Show Saved Queries').click()
  })

  test('shows empty state when no queries saved', async ({ page }) => {
    await expect(page.getByText('No saved queries yet')).toBeVisible()
  })

  test('save and load a query', async ({ page }) => {
    // Type a query in the editor
    const queryEditor = page.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ countries { capital } }', { delay: 10 })

    // Save it
    await page.getByPlaceholder('Query name...').fill('Capitals Query')
    await page.locator('.saved-queries-plugin').getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Capitals Query')).toBeVisible()

    // Type a different query
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ continents { name } }', { delay: 10 })

    // Load the saved query back and execute to verify
    await page.locator('.saved-queries-item').filter({ hasText: 'Capitals Query' }).click()
    await page.locator('.graphiql-execute-button').click()

    await expect(page.locator('.graphiql-response')).toContainText('capital', {
      timeout: 10_000,
    })
  })

  test('open a saved query in a new tab', async ({ page }) => {
    // Type a query in the editor
    const queryEditor = page.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ countries { capital } }', { delay: 10 })

    // Save it
    await page.getByPlaceholder('Query name...').fill('Tab Test Query')
    await page.locator('.saved-queries-plugin').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Tab Test Query')).toBeVisible()

    // Count existing GraphiQL editor tabs
    const tabsBefore = await page.locator('.graphiql-tab').count()

    // Click the "Open in new tab" button
    await page
      .locator('.saved-queries-item')
      .filter({ hasText: 'Tab Test Query' })
      .getByTitle('Open in new tab')
      .click()

    // Verify a new GraphiQL editor tab appeared
    await expect(page.locator('.graphiql-tab')).toHaveCount(tabsBefore + 1)

    // Verify the query content was loaded into the new tab's editor
    await expect(page.locator('.graphiql-query-editor')).toContainText('countries', {
      timeout: 5_000,
    })
  })

  test('delete a saved query', async ({ page }) => {
    // Save a query first
    const queryEditor = page.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('{ countries { name } }', { delay: 10 })

    await page.getByPlaceholder('Query name...').fill('Temp Query')
    await page.locator('.saved-queries-plugin').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Temp Query')).toBeVisible()

    // Delete it
    await page
      .locator('.saved-queries-item')
      .filter({ hasText: 'Temp Query' })
      .getByTitle('Delete')
      .click()
    await page.getByText('Confirm').click()

    await expect(page.getByText('Temp Query')).not.toBeVisible()
  })
})
