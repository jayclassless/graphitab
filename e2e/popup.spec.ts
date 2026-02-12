import { test, expect } from './fixtures'

test.describe('Popup', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
  })

  test('displays default demo profiles on fresh install', async ({ page }) => {
    await expect(page.getByText('Countries')).toBeVisible()
    await expect(page.getByText('SWAPI: The Star Wars API')).toBeVisible()
  })

  test('profiles are sorted alphabetically', async ({ page }) => {
    const profileLinks = page.locator('.popup-profile-item a')
    await expect(profileLinks.first()).toHaveText('Countries')
    await expect(profileLinks.nth(1)).toHaveText('SWAPI: The Star Wars API')
  })

  test('URL validation prevents submission of invalid URLs', async ({ page }) => {
    await page.getByText('+ New Profile').click()
    await page.getByPlaceholder('Name').fill('Test')
    await page.getByPlaceholder('GraphQL endpoint URL').fill('not-a-url')

    await expect(page.getByRole('button', { name: 'Add' })).toBeDisabled()
    await expect(page.getByPlaceholder('GraphQL endpoint URL')).toHaveClass(/popup-input-invalid/)
  })

  test('create a new profile', async ({ page }) => {
    await page.getByText('+ New Profile').click()
    await page.getByPlaceholder('Name').fill('Test API')
    await page.getByPlaceholder('GraphQL endpoint URL').fill('https://example.com/graphql')
    await page.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByPlaceholder('Name')).not.toBeVisible()
    await expect(page.getByText('Test API')).toBeVisible()
  })

  test('edit an existing profile', async ({ page }) => {
    await page.locator('.popup-profile-item').first().getByTitle('Edit').click()

    await expect(page.getByPlaceholder('Name')).toHaveValue('Countries')

    await page.getByPlaceholder('Name').clear()
    await page.getByPlaceholder('Name').fill('Countries Updated')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Countries Updated')).toBeVisible()
  })

  test('delete a profile with confirmation', async ({ page }) => {
    await page.locator('.popup-profile-item').first().getByTitle('Delete').click()
    await expect(page.getByText('Confirm')).toBeVisible()

    // Cancel keeps the profile
    await page.getByText('Cancel').click()
    const itemCount = await page.locator('.popup-profile-item').count()
    expect(itemCount).toBeGreaterThanOrEqual(2)

    // Delete for real
    await page.locator('.popup-profile-item').first().getByTitle('Delete').click()
    await page.getByText('Confirm').click()

    await expect(page.locator('.popup-profile-item')).toHaveCount(itemCount - 1)
  })

  test('profile data persists across popup reopens', async ({ page, extensionId }) => {
    await page.getByText('+ New Profile').click()
    await page.getByPlaceholder('Name').fill('Persistent API')
    await page.getByPlaceholder('GraphQL endpoint URL').fill('https://example.com/graphql')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('Persistent API')).toBeVisible()

    // Reload the popup (simulates close and reopen)
    await page.goto(`chrome-extension://${extensionId}/popup.html`)

    await expect(page.getByText('Persistent API')).toBeVisible()
  })
})
