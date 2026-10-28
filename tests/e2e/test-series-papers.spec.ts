import { expect, test } from '@playwright/test'

const bodyFits = async (page: import('@playwright/test').Page) => {
  const width = await page.locator('body').evaluate((body) => {
    const element = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: element.clientWidth, scroll: element.scrollWidth }
  })
  expect(width.scroll).toBeLessThanOrEqual(width.client)
}

test('Mock test offers exactly UCEED, CEED, NID and NIFT in the student portal sidebar', async ({
  page,
}) => {
  await page.goto('/tests/mock-test?preview=1')
  const nav = page.getByRole('navigation', { name: 'Student portal sections' })
  await expect(nav.getByRole('link', { name: 'Mock test' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Practice' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Coursework' })).toBeVisible()
  for (const retired of ['Overview', 'Papers', 'Mocks', 'Drawing', 'Analytics', 'Sketches']) {
    await expect(nav.getByRole('link', { name: retired, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('heading', { name: 'Mock test' })).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(4)
  await expect(page.getByRole('region', { name: 'UCEED', exact: true })).toContainText('Part B drawing 1 hour')
  await expect(page.getByRole('region', { name: 'CEED', exact: true })).toContainText('Part B drawing 2 hours')
  await expect(page.getByRole('region', { name: 'NID DAT' })).toContainText(
    'six drawing tasks in 3 hours',
  )
  await page.getByRole('button', { name: 'M.Des' }).click()
  await expect(page.getByRole('region', { name: 'NIFT' })).toContainText('M.Des GAT')
  // Preview shows the cards; starting a paper needs a real sign-in.
  await expect(page.getByRole('region', { name: 'UCEED', exact: true }).getByRole('button')).toBeDisabled()
})

test('dark theme re-themes the whole page and persists', async ({ page }) => {
  await page.goto('/tests/mock-test?preview=1')
  const shell = page.getByTestId('student-shell')
  const lightBackground = await shell.evaluate((element) => {
    const view = (
      element as unknown as {
        ownerDocument: {
          defaultView: { getComputedStyle: (e: unknown) => { backgroundColor: string } }
        }
      }
    ).ownerDocument.defaultView
    return view.getComputedStyle(element).backgroundColor
  })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(shell).not.toHaveCSS('background-color', lightBackground)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('phone layout uses a menu and never scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/tests/mock-test?preview=1')
  const menu = page.getByRole('button', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.click()
  await expect(page.getByRole('link', { name: 'Practice' })).toBeVisible()
  // Tap outside the open menu, as a person would.
  await page.getByRole('button', { name: 'Close menu' }).click({ position: { x: 340, y: 600 } })
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  await menu.click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await bodyFits(page)
})

test('old test-series links land on Mock test or Home', async ({ page }) => {
  await page.goto('/student/tests?preview=1')
  await expect(page).toHaveURL(/\/tests\/mock-test\?preview=1$/)
  for (const retired of ['papers', 'papers/uceed-2025', 'mocks', 'drawing']) {
    await page.goto(`/tests/${retired}?preview=1`)
    await expect(page).toHaveURL(/\/tests\/mock-test\?preview=1$/)
  }
  for (const retired of ['analytics', 'bookmarks', 'sketches']) {
    await page.goto(`/tests/${retired}?preview=1`)
    await expect(page).toHaveURL(/\/student\?preview=1$/)
  }
})

test('the test series requires sign-in outside preview', async ({ page }) => {
  await page.goto('/tests/mock-test')
  await expect(page).toHaveURL(/\/tests\/sign-in\?returnTo=%2Ftests%2Fmock-test$/)
})

test('the test-series sign-in offers Google and the Member ID route', async ({ page }) => {
  await page.goto('/tests/practice')
  await expect(page).toHaveURL(/\/tests\/sign-in\?returnTo=%2Ftests%2Fpractice$/)
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in with your Member ID' })).toHaveAttribute(
    'href',
    '/sign-in?returnTo=%2Ftests%2Fpractice',
  )
})

test('Home carries the test-series analytics and next steps in preview', async ({ page }) => {
  await page.goto('/student?preview=1')
  await expect(page.getByRole('heading', { name: 'Welcome, Aarohi.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your test series' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible()
  await expect(page.getByText('Shortlisting band')).toBeVisible()
  await expect(page.getByRole('link', { name: /Take a mock test/ })).toHaveAttribute(
    'href',
    '/tests/mock-test?preview=1',
  )
  await page.goto('/tests?preview=1')
  await expect(page).toHaveURL(/\/student\?preview=1$/)
})

test('a live mock opens its waiting room in preview', async ({ page }) => {
  await page.goto('/student?preview=1')
  await page.getByRole('link', { name: /Sample all-India UCEED live mock/ }).click()
  await expect(page).toHaveURL(/\/tests\/live\/sample\?preview=1$/)
  await expect(page.getByText('Waiting room')).toBeVisible()
  await expect(page.getByRole('timer', { name: 'Part A starts in' })).toBeVisible()
  await expect(page.getByText('SAMPLE-00042')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'How the live mock works' })).toBeVisible()
})

test('the live-event organiser page needs a staff sign-in', async ({ page }) => {
  await page.goto('/staff/live-events')
  await expect(page.getByRole('heading', { name: 'All-India live mocks' })).toHaveCount(0)
})

test('the Plans page asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto('/tests/plans')
  await expect(page).toHaveURL(/\/tests\/sign-in\?returnTo=%2Ftests%2Fplans$/)
})

test('the student portal and the test series share one left sidebar', async ({ page }) => {
  await page.goto('/student?preview=1')
  const nav = page.getByRole('navigation', { name: 'Student portal sections' })
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Mock test' }).click()
  await expect(page).toHaveURL(/\/tests\/mock-test\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'Mock test' })).toBeVisible()
  await nav.getByRole('link', { name: 'Coursework' }).click()
  await expect(page).toHaveURL(/\/student\/coursework\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'Your coursework.' })).toBeVisible()
})

test('the owner question review is never part of a build', async ({ page }) => {
  await page.goto('/review/questions')
  await expect(page.getByRole('heading', { name: 'Question review' })).toHaveCount(0)
  const response = await page.request.get('/__review/bank.json')
  expect(response.headers()['content-type'] ?? '').not.toContain('application/json')
})
