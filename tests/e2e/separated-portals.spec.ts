import { expect, test } from '@playwright/test'

test('public directory has four distinct sign-in entrances', async ({ page }) => {
  await page.goto('/')
  for (const [name, path] of [
    ['Student', '/sign-in'],
    ['Teacher', '/teacher/sign-in'],
    ['Staff', '/staff/sign-in'],
    ['Admin', '/admin/sign-in'],
  ]) {
    await expect(page.getByRole('link', { name: `Open ${name} portal` })).toHaveAttribute(
      'href',
      path,
    )
  }
})

for (const [portal, title] of [
  ['teacher', 'Teacher sign in'],
  ['admin', 'Admin sign in'],
]) {
  test(`${portal} has its own responsive sign-in without a preview bypass`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${portal}/sign-in`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByLabel('Employee email')).toBeVisible()
    await expect(page.locator(`[data-portal="${portal}"]`)).toBeVisible()
    const width = await page.locator('body').evaluate((body) => {
      const element = body as unknown as { clientWidth: number; scrollWidth: number }
      return { client: element.clientWidth, scroll: element.scrollWidth }
    })
    expect(width.scroll).toBeLessThanOrEqual(width.client)
  })
}

test('new teacher deep links preserve their own sign-in return path', async ({ page }) => {
  await page.goto('/teacher/reviews?instance=fictional')
  await expect(page).toHaveURL(
    /\/teacher\/sign-in\?returnTo=%2Fteacher%2Freviews%3Finstance%3Dfictional$/,
  )
})

test('admin entry never accepts fictional preview as authority', async ({ page }) => {
  await page.goto('/admin/employees?preview=1')
  await expect(page).toHaveURL(/\/admin\/sign-in\?returnTo=/)
  await expect(page.getByRole('heading', { name: 'Invite your team.' })).toHaveCount(0)
})

test('teacher preview is distinct from student and operational menus', async ({ page }) => {
  await page.goto('/teacher/reviews?preview=1')
  await expect(page.getByRole('heading', { name: 'Feedback review.' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Reviews' })).toHaveAttribute(
    'href',
    '/teacher/reviews?preview=1',
  )
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'CRM', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Coursework' })).toHaveCount(
    0,
  )
  await page.screenshot({ path: 'test-results/f033/teacher-preview.jpg', fullPage: false })
})

test('legacy teacher review bookmark retains the teacher layout and workflow', async ({ page }) => {
  await page.goto('/staff/reviews?preview=1')
  await expect(page.getByRole('heading', { name: 'Feedback review.' })).toBeVisible()
  await expect(page.locator('[data-portal="teacher"]')).toBeVisible()
})

test('student preview does not contain staff tools or employee switches', async ({ page }) => {
  await page.goto('/student?preview=1')
  await expect(page.locator('[data-portal="student"]')).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Coursework' })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Employees' })).toHaveCount(0)
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'CRM', exact: true }),
  ).toHaveCount(0)
  await page.screenshot({ path: 'test-results/f033/student-preview.jpg', fullPage: false })
})
