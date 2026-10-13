import { expect, test } from '@playwright/test'
for (const width of [1440, 390]) {
  test(`student recovery backup entry is responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/student/recover')
    await expect(page.getByLabel('Recovery backup code')).toBeVisible()
    await expect(page.getByText(/Hosted password recovery is disabled/)).toBeVisible()
    expect(
      await page.locator('body').evaluate((body) => {
        const dimensions = body as unknown as { scrollWidth: number; clientWidth: number }
        return dimensions.scrollWidth <= dimensions.clientWidth
      }),
    ).toBe(true)
  })
}
test('student recovery management cannot be bypassed by preview', async ({ page }) => {
  await page.goto('/staff/student-recovery?preview=1')
  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Propose forgotten-password recovery' }),
  ).toHaveCount(0)
})
test('invalid student recovery credentials are cleared before rendering', async ({ page }) => {
  // Invalid non-secret values only; real credentials never enter Playwright traces.
  await page.goto('/student/recover#memberId=invalid&token=invalid')
  await expect(page).toHaveURL(/\/student\/recover$/)
  await expect(page.getByLabel('Recovery backup code')).toBeVisible()
})
test('student sign-in exposes assisted recovery instructions', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'recover your student account' }).click()
  await expect(page).toHaveURL(/\/student\/recover$/)
})
