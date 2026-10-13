import { expect, test } from '@playwright/test'

test('employee invitation management cannot be bypassed by preview', async ({ page }) => {
  await page.goto('/staff/employees?preview=1')
  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prepare and deliver invitation' })).toHaveCount(0)
})

for (const width of [1440, 390]) {
  test(`employee activation safely explains a missing link at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/staff/activate')
    await expect(page.getByRole('heading', { name: 'Join your Dexam team.' })).toBeVisible()
    await expect(page.getByText(/Open the complete link/)).toBeVisible()
    await expect(page.getByLabel('New password')).toHaveCount(0)
    expect(
      await page.locator('body').evaluate((body) => {
        const element = body as unknown as { scrollWidth: number; clientWidth: number }
        return element.scrollWidth <= element.clientWidth
      }),
    ).toBe(true)
  })
}

test('malformed invitation credentials are removed from browser location before rendering', async ({
  page,
}) => {
  // Deliberately invalid, non-secret values; never record a real invitation URL in a trace.
  await page.goto('/staff/activate#request=invalid&proof=invalid&token_hash=invalid&type=invite')
  await expect(page).toHaveURL(/\/staff\/activate$/)
  await expect(page.getByText(/Open the complete link/)).toBeVisible()
})
