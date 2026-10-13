import { expect, test } from '@playwright/test'
test('malformed activation query proof is cleared before rendering', async ({ page }) => {
  await page.goto('/activate?memberId=invalid&token=invalid')
  await expect(page).toHaveURL(/\/activate$/)
  await expect(page.getByLabel('One-time activation code')).toBeVisible()
})
test('malformed activation fragment proof is cleared before rendering', async ({ page }) => {
  await page.goto('/activate#memberId=invalid&token=invalid')
  await expect(page).toHaveURL(/\/activate$/)
  await expect(page.getByLabel('One-time activation code')).toBeVisible()
})
