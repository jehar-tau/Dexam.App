import { expect, test } from '@playwright/test'

test('foundation shell is reachable and navigable', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'The Dexam platform starts here.' })).toBeVisible()

  await page.getByRole('link', { name: 'System status' }).click()
  await expect(page).toHaveURL(/\/health$/)
  await expect(page.getByRole('heading', { name: 'Application shell operational' })).toBeVisible()
})
