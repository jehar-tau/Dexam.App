import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('the new admissions route never accepts the fictional administrator preview flag', async ({
  page,
}) => {
  await page.goto('/admin/admissions?preview=1')
  await expect(page).toHaveURL(/\/admin\/sign-in\?returnTo=/)
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'One student. One shared record.' })).toHaveCount(
    0,
  )
})
for (const width of [1440, 390]) {
  test(`Google cancellation is accessible and keeps credentials private at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/auth/google?error=access_denied&returnTo=https://evil.invalid')
    await expect(page.getByRole('alert')).toHaveText(
      'Google sign-in was cancelled or could not complete.',
    )
    await expect(page.getByRole('link', { name: 'Student sign in', exact: true })).toHaveAttribute(
      'href',
      '/sign-in',
    )
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`google-cancel-${width}.png`),
      fullPage: true,
    })
  })
}
