import { expect, test } from '@playwright/test'

test('course closeout cannot be accessed using operator preview', async ({ page }) => {
  await page.goto('/staff/enrolment-closeout?preview=1')
  await expect(page).toHaveURL(/staff\/sign-in/)
})

test('private work archive requires student sign-in', async ({ page }) => {
  await page.goto('/student/archive?preview=1')
  await expect(page).toHaveURL(/sign-in/)
})

test('private study checklist cannot use student preview', async ({ page }) => {
  await page.goto('/student/study-checklist?preview=1')
  await expect(page).toHaveURL(/sign-in/)
  await expect(page.getByRole('button', { name: /Mark as studied|Undo study mark/ })).toHaveCount(0)
})
