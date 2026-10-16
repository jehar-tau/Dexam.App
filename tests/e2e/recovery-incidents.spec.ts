import { expect, test } from '@playwright/test'
test('recovery incident authority cannot be bypassed by preview', async ({ page }) => {
  await page.goto('/staff/security/incidents?preview=1')
  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open investigation' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Uncertain recovery requests' })).toHaveCount(0)
})
