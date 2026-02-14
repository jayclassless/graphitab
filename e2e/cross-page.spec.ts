import { test, expect } from './fixtures'

test.describe('Cross-page flow', () => {
  test('clicking a profile link in popup opens GraphiQL in a new tab', async ({
    context,
    page,
    extensionId,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(page.getByText('Countries')).toBeVisible()

    // Click the profile link — it opens in a new tab (target="_blank")
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByText('Countries').click(),
    ])

    await newPage.waitForLoadState()

    await expect(newPage.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(newPage).toHaveTitle('Countries - GraphiTab')
  })

  test('editing a profile in the popup syncs to an open GraphiQL tab', async ({
    context,
    page,
    extensionId,
  }) => {
    // Open GraphiQL for the Countries profile
    const graphiqlPage = await context.newPage()
    await graphiqlPage.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await expect(graphiqlPage.locator('.graphiql-execute-button')).toBeVisible({
      timeout: 15_000,
    })
    await expect(graphiqlPage).toHaveTitle('Countries - GraphiTab')

    // Edit the profile name in the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'Countries' })
      .getByTitle('Edit')
      .click()
    await page.getByPlaceholder('Name').clear()
    await page.getByPlaceholder('Name').fill('Countries Renamed')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Countries Renamed')).toBeVisible()

    // Verify the open GraphiQL tab picked up the name change
    await expect(graphiqlPage).toHaveTitle('Countries Renamed - GraphiTab', {
      timeout: 5_000,
    })
  })
})
