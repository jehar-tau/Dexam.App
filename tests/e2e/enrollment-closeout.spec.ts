import { expect, test } from '@playwright/test'

test('course closeout cannot be accessed using operator preview', async ({ page }) => {
  await page.goto('/staff/enrolment-closeout?preview=1')
  await expect(page).toHaveURL(/staff\/sign-in/)
})

test('private work archive requires student sign-in', async ({ page }) => {
  await page.goto('/student/archive?preview=1')
  await expect(page).toHaveURL(/sign-in/)
})
