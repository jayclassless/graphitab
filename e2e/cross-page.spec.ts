import { type Page } from '@playwright/test'

import { test, expect } from './fixtures'

/** Wait for GraphiQL to fully load on a page. */
async function waitForGraphiQL(page: Page) {
  await expect(page.locator('.graphiql-execute-button')).toBeVisible({
    timeout: 15_000,
  })
}

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
    await waitForGraphiQL(graphiqlPage)
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

test.describe('Profile deletion modal', () => {
  test('deleting a profile shows the deleted modal on the open GraphiQL tab', async ({
    context,
    page,
    extensionId,
  }) => {
    // Open GraphiQL for the Countries profile
    const graphiqlPage = await context.newPage()
    await graphiqlPage.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await waitForGraphiQL(graphiqlPage)

    // Delete the profile from the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'Countries' })
      .getByTitle('Delete')
      .click()
    await page.getByText('Confirm').click()

    // Verify the modal appears in the GraphiQL tab
    await expect(graphiqlPage.locator('.profile-deleted-modal')).toBeVisible({ timeout: 5_000 })
    await expect(graphiqlPage.getByText('Countries')).toBeVisible()
    await expect(graphiqlPage.getByText('has been deleted.')).toBeVisible()
    await expect(graphiqlPage.getByRole('button', { name: 'Restore' })).toBeVisible()
    await expect(graphiqlPage.getByRole('button', { name: 'Close Tab' })).toBeVisible()
  })

  test('restoring a deleted profile dismisses the modal and re-enables GraphiQL', async ({
    context,
    page,
    extensionId,
  }) => {
    // Open GraphiQL for the Countries profile
    const graphiqlPage = await context.newPage()
    await graphiqlPage.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await waitForGraphiQL(graphiqlPage)

    // Delete the profile from the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'Countries' })
      .getByTitle('Delete')
      .click()
    await page.getByText('Confirm').click()

    // Wait for modal to appear, then restore
    await expect(graphiqlPage.locator('.profile-deleted-modal')).toBeVisible({ timeout: 5_000 })
    await graphiqlPage.getByRole('button', { name: 'Restore' }).click()

    // Modal should disappear and GraphiQL should still be functional
    await expect(graphiqlPage.locator('.profile-deleted-modal')).not.toBeVisible()
    await expect(graphiqlPage.locator('.graphiql-execute-button')).toBeVisible()

    // Profile should reappear in the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(page.getByText('Countries')).toBeVisible()
  })

  test('restoring a deleted profile preserves saved queries', async ({
    context,
    page,
    extensionId,
  }) => {
    // Open GraphiQL for the Countries profile and save a query
    const graphiqlPage = await context.newPage()
    await graphiqlPage.goto(`chrome-extension://${extensionId}/graphiql.html?profile=countries`)
    await waitForGraphiQL(graphiqlPage)

    // Open Saved Queries plugin and save a query
    await graphiqlPage.getByLabel('Show Saved Queries').click()
    const queryEditor = graphiqlPage.locator('.graphiql-query-editor .monaco-editor textarea')
    await queryEditor.click({ force: true })
    await graphiqlPage.keyboard.press('ControlOrMeta+a')
    await graphiqlPage.keyboard.press('Backspace')
    await graphiqlPage.keyboard.type('{ countries { capital } }', { delay: 10 })
    await graphiqlPage.getByPlaceholder('Query name...').fill('Capitals E2E')
    await graphiqlPage
      .locator('.saved-queries-plugin')
      .getByRole('button', { name: 'Save' })
      .click()
    await expect(graphiqlPage.getByText('Capitals E2E')).toBeVisible()

    // Delete the profile from the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'Countries' })
      .getByTitle('Delete')
      .click()
    await page.getByText('Confirm').click()

    // Restore from the modal
    await expect(graphiqlPage.locator('.profile-deleted-modal')).toBeVisible({ timeout: 5_000 })
    await graphiqlPage.getByRole('button', { name: 'Restore' }).click()
    await expect(graphiqlPage.locator('.profile-deleted-modal')).not.toBeVisible()

    // Reload GraphiQL and verify the saved query survived
    await graphiqlPage.reload()
    await waitForGraphiQL(graphiqlPage)
    await graphiqlPage.getByLabel('Show Saved Queries').click()
    await expect(graphiqlPage.getByText('Capitals E2E')).toBeVisible({ timeout: 5_000 })
  })

  test('Close Tab button closes the GraphiQL tab', async ({ context, page, extensionId }) => {
    // Open GraphiQL for the SWAPI profile
    const graphiqlPage = await context.newPage()
    await graphiqlPage.goto(`chrome-extension://${extensionId}/graphiql.html?profile=swapi`)
    await waitForGraphiQL(graphiqlPage)

    const pageCountBefore = context.pages().length

    // Delete the profile from the popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page
      .locator('.popup-profile-item')
      .filter({ hasText: 'SWAPI' })
      .getByTitle('Delete')
      .click()
    await page.getByText('Confirm').click()

    // Wait for modal, then click Close Tab
    await expect(graphiqlPage.locator('.profile-deleted-modal')).toBeVisible({ timeout: 5_000 })
    await graphiqlPage.getByRole('button', { name: 'Close Tab' }).click()

    // The GraphiQL tab should close — page count decreases
    await expect(async () => {
      expect(context.pages().length).toBeLessThan(pageCountBefore)
    }).toPass({ timeout: 5_000 })
  })
})
