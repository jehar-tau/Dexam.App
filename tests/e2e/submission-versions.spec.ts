import { expect, test } from '@playwright/test'

test('student edits an unreviewed attempt and submits second and third attempts', async ({
  page,
}) => {
  await page.goto('/student/assignments?preview=1')
  await page.getByRole('button', { name: 'Start submission' }).click()
  async function upload(name: string) {
    await page.getByLabel('Add PDF or images').setInputFiles({
      name,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% fictional drawing study\n'),
    })
    await page.getByRole('button', { name: 'Upload reviewed files' }).click()
    await expect(page.getByRole('heading', { name: 'Uploaded privately' })).toBeVisible()
  }
  await upload('original.pdf')
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click()
  await page.getByRole('button', { name: 'Edit attempt 1', exact: true }).click()
  await expect(page.getByText('original.pdf', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await upload('updated.pdf')
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click()
  await expect(page.getByText('Version 2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start another attempt' }).click()
  await expect(page.getByText('Attempt 2', { exact: true })).toBeVisible()
  await upload('second.pdf')
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click()
  await page.getByRole('button', { name: 'Start another attempt' }).click()
  await expect(page.getByText('Attempt 3', { exact: true })).toBeVisible()
  await expect(page.getByText('Attempt 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Attempt 2', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/f034/multiple-attempts.png', fullPage: true })
})

test('reviewed work is locked but a new attempt is allowed on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/student/assignments?preview=1&assignment=preview-assignment-lines')
  await expect(page.getByText('Reviewed — this attempt is locked.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit attempt 1' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start another attempt' }).click()
  await expect(page.getByText('Attempt 2', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Teacher feedback' })).toBeVisible()
  expect(
    await page.locator('body').evaluate((body) => {
      const dimensions = body as unknown as { scrollWidth: number; clientWidth: number }
      return dimensions.scrollWidth <= dimensions.clientWidth
    }),
  ).toBe(true)
})

test('teacher explicitly reviews changed files before publishing a version', async ({ page }) => {
  await page.goto('/teacher/reviews?preview=1&attempt=preview-attempt-two')
  await expect(page.getByText(/The student edited their work/)).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Written feedback', exact: true })
    .fill('The updated perspective is clear.')
  await page.getByRole('button', { name: 'Publish & complete review' }).click()
  await expect(page.getByText(/confirm this submission version/)).toBeVisible()
  await page.getByText('Previous version draft — reference only').click()
  await expect(page.getByText(/Earlier draft about the original construction study/)).toBeVisible()
  await page.getByLabel('I have reviewed the updated files for this version').check()
  await page.getByRole('button', { name: 'Publish & complete review' }).click()
  await expect(page.getByText(/Feedback published/)).toBeVisible()
})
