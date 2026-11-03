import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// All previews are existing fictional fixtures. Protected access is never bypassed.
const routes = [
  ['entrance', '/'],
  ['student-sign-in', '/sign-in'],
  ['candidate-sign-in', '/tests/sign-in'],
  ['activation', '/activate'],
  ['admin-sign-in', '/admin/sign-in'],
  ['student-home', '/student?preview=1'],
  ['coursework', '/student/coursework?preview=1'],
  ['assignments', '/student/assignments?preview=1'],
  ['practice', '/tests/practice?preview=1'],
  ['mock-test', '/tests/mock-test?preview=1'],
  ['teacher-home', '/teacher?preview=1'],
  ['staff-content', '/staff/content?preview=1'],
  ['staff-reviews', '/staff/reviews?preview=1'],
  ['staff-admissions', '/staff/crm?preview=1'],
  ['notifications', '/student/notifications?preview=1'],
] as const

for (const width of [1440, 390]) {
  for (const [name, path] of routes) {
    test(`${name} is readable and accessible at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const dimensions = await page.locator('body').evaluate((body) => {
        const measured = body as unknown as { clientWidth: number; scrollWidth: number }
        return { client: measured.clientWidth, scroll: measured.scrollWidth }
      })
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
      const violations = (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations
      expect(
        violations.map(({ id, nodes }) => ({ id, elements: nodes.map((node) => node.target) })),
      ).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true })
    })
  }
}

test('Discovery stays readable in dark mode and preserves the theme toggle', async ({
  page,
}, testInfo) => {
  await page.goto('/tests/mock-test?preview=1')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // Measure the settled palette, not interpolated colours during the theme transition.
  await page.locator('html').evaluate(async (element) => {
    const root = element as unknown as {
      getAnimations: (options: { subtree: boolean }) => Array<{
        transitionProperty?: string
        finished: Promise<unknown>
      }>
    }
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((animation) => typeof animation.transitionProperty === 'string')
        .map(async (animation) => {
          await animation.finished.catch(() => undefined)
        }),
    )
  })
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('mock-test-dark.png'), fullPage: true })
  await page.getByRole('button', { name: 'Switch to light theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('the phone menu returns keyboard focus when dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tests/mock-test?preview=1')
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  await menu.click()
  const home = page
    .getByRole('navigation', { name: 'Student portal sections' })
    .getByRole('link', { name: 'Home', exact: true })
  await expect(home).toBeFocused()
  await home.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeFocused()
})
