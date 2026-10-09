import { expect, test } from '@playwright/test'

test('foundation shell is reachable and navigable', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'The Dexam platform starts here.' })).toBeVisible()

  await page.getByRole('link', { name: 'System status' }).click()
  await expect(page).toHaveURL(/\/health$/)
  await expect(page.getByRole('heading', { name: 'Application shell operational' })).toBeVisible()
})

test('student activation route presents the secure account form', async ({ page }) => {
  await page.goto('/activate')

  await expect(page.getByRole('heading', { name: 'Activate your Dexam account.' })).toBeVisible()
  await expect(page.getByLabel('Dexam Member ID')).toBeVisible()
  await expect(page.getByLabel('One-time activation code')).toBeVisible()
  await expect(page.getByLabel('Create password')).toHaveAttribute('type', 'password')
})

test('employee sign-in route presents protected staff access', async ({ page }) => {
  await page.goto('/staff/sign-in')

  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
  await expect(page.getByLabel('Employee email')).toHaveAttribute('type', 'email')
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
})

test('student sign-in route presents Member ID access', async ({ page }) => {
  await page.goto('/sign-in')

  await expect(page.getByRole('heading', { name: 'Continue your learning.' })).toBeVisible()
  await expect(page.getByLabel('Dexam Member ID')).toBeVisible()
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
})

test('protected student route redirects to student sign in', async ({ page }) => {
  await page.goto('/student')

  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fstudent$/)
  await expect(page.getByRole('heading', { name: 'Continue your learning.' })).toBeVisible()
})

test('student workspace shows a fictional self-service preview', async ({ page }) => {
  await page.goto('/student?preview=1')

  await expect(page.getByRole('heading', { name: 'Welcome, Aarohi.' })).toBeVisible()
  await expect(page.getByText('DXM-2K3M9Q2RW5TY')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Design Entrance Foundation' })).toBeVisible()
})

test('student workspace remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/student?preview=1')

  await expect(page.getByRole('heading', { name: 'Welcome, Aarohi.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('protected staff route redirects to employee sign-in', async ({ page }) => {
  await page.goto('/staff/enrolments')

  await expect(page).toHaveURL(/\/staff\/sign-in\?returnTo=%2Fstaff%2Fenrolments$/)
  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
})

test('employee sign-in remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/sign-in')

  await expect(page.getByRole('heading', { name: 'Welcome back to Dexam.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('Enrolment Operator reviews and issues a fictional activation pack', async ({ page }) => {
  await page.goto('/staff/enrolments?preview=1')

  await expect(page.getByRole('heading', { name: 'Activation queue' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search queue' }).fill('Nobody')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('No matching enrolments')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByText('Aarohi Deshmukh')).toBeVisible()
  await page.getByRole('button', { name: 'Review enrolment' }).click()
  await expect(page.getByRole('heading', { name: 'Issue activation pack?' })).toBeVisible()

  await page.getByRole('button', { name: 'Issue activation pack' }).click()

  await expect(
    page.getByRole('heading', { name: 'Hand this directly to the student.' }),
  ).toBeVisible()
  await expect(page.getByText('7K3M9Q2RW5')).toBeVisible()
})
