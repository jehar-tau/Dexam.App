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

test('direct coursework route preserves a safe student return path', async ({ page }) => {
  await page.goto('/student/coursework')

  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fstudent%2Fcoursework$/)
  await expect(page.getByRole('heading', { name: 'Continue your learning.' })).toBeVisible()
})

test('direct assignments route preserves a safe student return path', async ({ page }) => {
  await page.goto('/student/assignments')

  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fstudent%2Fassignments$/)
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

test('student browses the fictional published curriculum preview', async ({ page }) => {
  await page.goto('/student/coursework?preview=1')

  await expect(page.getByRole('heading', { name: 'Your coursework.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lines, ovals & circles' })).toBeVisible()
  await page.getByRole('button', { name: /Perspective/ }).click()
  await expect(page.getByRole('heading', { name: 'Perspective', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'One-point perspective' })).toBeVisible()
})

test('student coursework remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/student/coursework?preview=1')

  await expect(page.getByRole('heading', { name: 'Your coursework.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('student prepares and submits a fictional private assignment', async ({ page }) => {
  await page.goto('/student/assignments?preview=1')

  await expect(page.getByRole('heading', { name: 'Your assignments.' })).toBeVisible()
  await page.getByRole('button', { name: 'Start submission' }).click()
  await page.getByLabel('Add PDF or images').setInputFiles({
    name: 'perspective-study.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% fictional assignment\n'),
  })
  await expect(page.getByRole('heading', { name: 'Review before upload' })).toBeVisible()
  await page.getByRole('button', { name: 'Upload reviewed files' }).click()
  await expect(page.getByRole('heading', { name: 'Uploaded privately' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit assignment' }).click()
  await expect(page.getByRole('heading', { name: 'Attempt history' })).toBeVisible()
  await expect(page.getByText(/Submitted/).first()).toBeVisible()
})

test('student assignments remain usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/student/assignments?preview=1')

  await expect(page.getByRole('heading', { name: 'Your assignments.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('student reads an update and opens its protected assignment destination', async ({ page }) => {
  await page.goto('/student/notifications?preview=1')

  await expect(page.getByRole('heading', { name: 'Notifications.' })).toBeVisible()
  await expect(page.getByLabel('2 unread notifications')).toBeVisible()
  await page
    .getByRole('heading', { name: 'Teacher feedback available' })
    .locator('..')
    .getByRole('link', { name: /Open update/ })
    .click()

  await expect(page).toHaveURL(/assignment=preview-assignment-lines/)
  await expect(page.getByRole('heading', { name: 'Line confidence practice' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Teacher feedback' })).toBeVisible()
})

test('student notification centre remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/student/notifications?preview=1')

  await expect(page.getByRole('heading', { name: 'Notifications.' })).toBeVisible()
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

test('content editor changes material and reviews assignment controls in preview', async ({
  page,
}) => {
  await page.goto('/staff/content?preview=1')

  await expect(page.getByRole('heading', { name: 'Content workspace' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Perspective', exact: true })).toBeVisible()
  await page.getByLabel('Topic title').fill('Perspective drawing')
  await page.getByRole('button', { name: 'Save topic changes' }).click()
  await expect(page.getByText('Topic material saved to this draft.')).toBeVisible()

  await page.getByRole('tab', { name: /Assignments/ }).click()
  await expect(page.getByLabel('Student instructions')).toBeVisible()
  await expect(page.getByText(/maximum 5 files/)).toBeVisible()
})

test('content workspace remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/content?preview=1')

  await expect(page.getByRole('heading', { name: 'Content workspace' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('academic staff deliberately releases a fictional assignment', async ({ page }) => {
  await page.goto('/staff/assignments?preview=1')

  await expect(page.getByRole('heading', { name: 'Assignment distribution.' })).toBeVisible()
  await page.getByLabel('Release note').fill('Weekly perspective practice')
  await page.getByRole('button', { name: 'Release assignment' }).click()
  await expect(page.getByText('Assignment released to the cohort.')).toBeVisible()
})

test('assignment distribution remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/assignments?preview=1')

  await expect(page.getByRole('heading', { name: 'Assignment distribution.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('teacher dictates, proofreads, accepts, and publishes fictional feedback', async ({
  page,
}) => {
  await page.goto('/staff/reviews?preview=1')

  await expect(page.getByRole('heading', { name: 'Feedback review.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Aarohi Deshmukh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preview line-practice.jpg' })).toBeVisible()
  await page.getByRole('button', { name: 'Preview line-practice.jpg' }).click()
  await expect(page.getByRole('dialog', { name: 'line-practice.jpg' })).toBeVisible()
  await page.getByRole('button', { name: 'Close preview' }).click()
  await page.getByRole('button', { name: 'Dictate feedback' }).click()
  await expect(page.getByText('Microphone active')).toBeVisible()
  await page.getByRole('button', { name: 'Stop dictation' }).click()
  await expect(page.getByRole('textbox', { name: 'Written feedback' })).toHaveValue(/line control/)
  await page.getByRole('button', { name: 'Dictate correction' }).click()
  await expect(page.getByText('Microphone active')).toBeVisible()
  await page.getByRole('button', { name: 'Stop correction dictation' }).click()
  await page.getByRole('button', { name: 'Proofread correction with AI' }).click()
  await expect(page.getByText('Correction wording suggestion')).toBeVisible()
  await page.getByRole('button', { name: 'Accept correction suggestion' }).click()
  await page.getByRole('button', { name: 'Proofread with AI' }).click()
  await expect(page.getByRole('heading', { name: 'Proofreading suggestion' })).toBeVisible()
  await page.getByRole('button', { name: 'Accept suggestion' }).click()
  await page.getByRole('button', { name: 'Publish & complete review' }).click()
  await expect(page.getByText(/assignment is now review completed/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kabir Mehta' })).toBeVisible()
})

test('teacher feedback review remains usable at a mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/reviews?preview=1')

  await expect(page.getByRole('heading', { name: 'Feedback review.' })).toBeVisible()
  const widths = await page.locator('body').evaluate((body) => {
    const measuredBody = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: measuredBody.clientWidth, scroll: measuredBody.scrollWidth }
  })
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
})

test('teacher opens the submitted work selected by a notification', async ({ page }) => {
  await page.goto('/staff/notifications?preview=1')

  await expect(page.getByRole('heading', { name: 'Notifications.' })).toBeVisible()
  await page
    .getByRole('link', { name: /Open update/ })
    .nth(1)
    .click()
  await expect(page).toHaveURL(/instance=preview-instance-two/)
  await expect(page.getByRole('heading', { name: 'Kabir Mehta' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Preview perspective-room.jpg' })).toBeVisible()
})

test('student sees published teacher-reviewed feedback in assignment history', async ({ page }) => {
  await page.goto('/student/assignments?preview=1')
  await page.getByRole('button', { name: /Line confidence practice/ }).click()

  await expect(page.getByRole('heading', { name: 'Teacher feedback' })).toBeVisible()
  await expect(
    page.getByText(/AI-assisted writing, reviewed and published by your teacher/),
  ).toBeVisible()
})
