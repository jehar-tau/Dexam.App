import { expect, test } from '@playwright/test'

test('test-series Papers page sits in the student portal sidebar and opens a paper', async ({
  page,
}) => {
  await page.goto('/tests/papers?preview=1')
  const nav = page.getByRole('navigation', { name: 'Student portal sections' })
  await expect(nav.getByRole('link', { name: 'Papers' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Coursework' })).toBeVisible()
  for (const retired of ['Analytics', 'Bookmarks', 'Sketches']) {
    await expect(nav.getByRole('link', { name: retired })).toHaveCount(0)
  }
  await expect(page.getByRole('heading', { name: 'Your paper dashboard' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'UCEED' })).toBeVisible()

  await page.getByRole('button', { name: 'M.Des' }).click()
  await expect(page.getByRole('region', { name: 'CEED' })).toBeVisible()
  await page.getByRole('button', { name: 'B.Des' }).click()

  await page.getByRole('link', { name: '2025, best 128 of 200, 2 attempts' }).click()
  await expect(page).toHaveURL(/\/tests\/papers\/uceed-2025\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'UCEED 2025' })).toBeVisible()
})

test('dark theme re-themes the whole page and persists', async ({ page }) => {
  await page.goto('/tests/papers?preview=1')
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
  await page.goto('/tests/papers?preview=1')
  const menu = page.getByRole('button', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.click()
  await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible()
  // Tap outside the open menu, as a person would.
  await page.getByRole('button', { name: 'Close menu' }).click({ position: { x: 340, y: 600 } })
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
  await menu.click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  const width = await page.locator('body').evaluate((body) => {
    const element = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: element.clientWidth, scroll: element.scrollWidth }
  })
  expect(width.scroll).toBeLessThanOrEqual(width.client)
})

test('the old test-series demo URL redirects to Papers', async ({ page }) => {
  await page.goto('/student/tests?preview=1')
  await expect(page).toHaveURL(/\/tests\/papers\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'Your paper dashboard' })).toBeVisible()
})

test('the test series requires sign-in outside preview', async ({ page }) => {
  await page.goto('/tests/papers')
  await expect(page).toHaveURL(/\/tests\/sign-in\?returnTo=%2Ftests%2Fpapers$/)
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

test('retired Analytics, Bookmarks and Sketches links land on the Overview', async ({ page }) => {
  for (const retired of ['analytics', 'bookmarks', 'sketches']) {
    await page.goto(`/tests/${retired}?preview=1`)
    await expect(page).toHaveURL(/\/tests\?preview=1$/)
    await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible()
  }
})

test('the Mocks page lists 2026 mocks in preview', async ({ page }) => {
  await page.goto('/tests/mocks?preview=1')
  await expect(page.getByRole('region', { name: 'UCEED 2026 mock' })).toBeVisible()
  await page.getByRole('button', { name: 'M.Des' }).click()
  await expect(page.getByRole('region', { name: 'CEED 2026 mock' })).toBeVisible()
})

test('the Overview shows standing and next steps in preview', async ({ page }) => {
  await page.goto('/tests?preview=1')
  await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible()
  await expect(page.getByText('Shortlisting band')).toBeVisible()
  await expect(page.getByRole('link', { name: /Take a full mock/ })).toHaveAttribute(
    'href',
    '/tests/mocks?preview=1',
  )
})

test('a live mock opens its waiting room in preview', async ({ page }) => {
  await page.goto('/tests/mocks?preview=1')
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
  await nav.getByRole('link', { name: 'Papers' }).click()
  await expect(page).toHaveURL(/\/tests\/papers\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'Your paper dashboard' })).toBeVisible()
  await nav.getByRole('link', { name: 'Coursework' }).click()
  await expect(page).toHaveURL(/\/student\/coursework\?preview=1$/)
  await expect(page.getByRole('heading', { name: 'Your coursework.' })).toBeVisible()
})

test('drawing papers list NID DAT 3-hour drawing mocks and Part B papers in preview', async ({
  page,
}) => {
  await page.goto('/tests/drawing?preview=1')
  const nav = page.getByRole('navigation', { name: 'Student portal sections' })
  await expect(nav.getByRole('link', { name: 'Drawing' })).toHaveAttribute('aria-current', 'page')
  const mock = page.getByRole('region', { name: 'NID DAT B.Des drawing mock 1' })
  await expect(mock).toContainText('6 tasks · 180 minutes · 100 marks')
  await expect(page.getByRole('region', { name: 'UCEED 2025 · Part B' })).toContainText(
    '60 minutes',
  )
  await page.getByRole('button', { name: 'M.Des' }).click()
  await expect(page.getByRole('region', { name: 'CEED 2026 · Part B' })).toContainText(
    '120 minutes',
  )
})

test('the owner question review is never part of a build', async ({ page }) => {
  await page.goto('/review/questions')
  await expect(page.getByRole('heading', { name: 'Question review' })).toHaveCount(0)
  const response = await page.request.get('/__review/bank.json')
  expect(response.headers()['content-type'] ?? '').not.toContain('application/json')
})

test('the Mocks page offers the 3-hour NID DAT drawing mock beside the objective mocks', async ({
  page,
}) => {
  await page.goto('/tests/mocks?preview=1')
  await expect(page.getByRole('region', { name: 'UCEED 2026 mock' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'NID DAT B.Des drawing mock' })).toContainText(
    '6 drawing tasks · 3 hours · 100 marks',
  )
  await page.getByRole('button', { name: 'M.Des' }).click()
  await expect(page.getByRole('region', { name: 'NID DAT M.Des drawing mock' })).toBeVisible()
})
