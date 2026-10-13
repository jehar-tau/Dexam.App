import { expect, test } from '@playwright/test'
for (const width of [1440, 390]) {
  test(`employee recovery request is responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/staff/recover')
    await expect(page.getByRole('heading', { name: 'Get back to your team.' })).toBeVisible()
    await expect(page.getByLabel('Employee email')).toBeVisible()
    expect(
      await page.locator('body').evaluate((body) => {
        const dimensions = body as unknown as { scrollWidth: number; clientWidth: number }
        return dimensions.scrollWidth <= dimensions.clientWidth
      }),
    ).toBe(true)
  })
}
test('employee sign-in links to password recovery', async ({ page }) => {
  await page.goto('/staff/sign-in')
  await page.getByRole('link', { name: 'Forgot your employee password?' }).click()
  await expect(page).toHaveURL(/\/staff\/recover$/)
})
test('malformed recovery credentials are cleared before rendering', async ({ page }) => {
  await page.goto('/staff/recover#request=invalid&proof=invalid&token_hash=invalid&type=recovery')
  await expect(page).toHaveURL(/\/staff\/recover$/)
  await expect(page.getByRole('button', { name: 'Request recovery link' })).toBeVisible()
})
