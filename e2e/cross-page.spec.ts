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
})
