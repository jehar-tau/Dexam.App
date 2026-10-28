import { expect, test, type Page } from '@playwright/test'

async function enterExam(page: Page) {
  await page.goto('/tests/papers/uceed-2025?preview=1')
  await page.getByRole('link', { name: 'Start timed paper' }).click()
  await expect(page).toHaveURL(/\/tests\/exam\/uceed-2025\?preview=1$/)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'General instructions' })).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('checkbox', { name: /I have read and understood/ }).check()
  await page.getByRole('button', { name: 'I am ready to begin' }).click()
  await expect(page.getByRole('heading', { name: 'Question 1' })).toBeVisible()
}

test('a candidate takes the practice paper from login to submission', async ({ page }) => {
  await enterExam(page)
  const palette = page.getByRole('complementary', { name: 'Question palette' })

  await page.getByRole('textbox', { name: 'Your answer' }).fill('12')
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(palette.getByRole('button', { name: 'Question 1, answered' })).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: /MCQ/ })
    .click()
  await page.getByRole('radio', { name: /Isometric view/ }).check()
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click()
  await expect(
    palette.getByRole('button', { name: 'Question 9, answered and marked for review' }),
  ).toBeVisible()

  // A reload resumes the attempt where it was.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Question 10' })).toBeVisible()

  await palette.getByRole('button', { name: 'Submit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Submit the paper?' })
  await expect(dialog).toContainText('12 questions are not answered')
  await dialog.getByRole('button', { name: 'Yes, submit' }).click()
  await expect(page.getByRole('heading', { name: 'Your paper has been submitted.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to papers' }).click()
  await expect(page).toHaveURL(/\/tests\/papers\?preview=1$/)
})

test('on a phone the palette opens on demand and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await enterExam(page)
  const toggle = page.getByRole('button', { name: 'Question palette' })
  await expect(page.getByRole('complementary', { name: 'Question palette' })).toBeHidden()
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Hide palette' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.getByRole('button', { name: 'Question 3, not visited' }).click()
  await expect(page.getByRole('heading', { name: 'Question 3' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Question palette' })).toBeHidden()

  const width = await page.locator('body').evaluate((body) => {
    const element = body as unknown as { clientWidth: number; scrollWidth: number }
    return { client: element.clientWidth, scroll: element.scrollWidth }
  })
  expect(width.scroll).toBeLessThanOrEqual(width.client)
})

test('the exam window requires sign-in outside preview', async ({ page }) => {
  await page.goto('/tests/exam/uceed-2025')
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Ftests%2Fexam%2Fuceed-2025$/)
})
