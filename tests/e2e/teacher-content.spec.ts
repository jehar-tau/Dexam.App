import { expect, test } from '@playwright/test'

test('teacher content supports several named lesson and assignment files', async ({ page }) => {
  await page.goto('/teacher/content?preview=1')
  await expect(page.getByRole('link', { name: 'Content', exact: true })).toHaveAttribute(
    'href',
    '/teacher/content?preview=1',
  )
  await expect(page.getByRole('heading', { name: 'Content workspace', exact: true })).toBeVisible()
  const files = ['study.pdf', 'example.pdf'].map((name) => ({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 fictional reference'),
  }))
  await page.getByLabel('Attach lesson files').setInputFiles(files)
  await page.getByLabel('Attachment name for study.pdf').fill('Perspective construction guide')
  await page.getByRole('button', { name: 'Save attachment name' }).first().click()
  await expect(
    page.getByText('Perspective construction guide · study.pdf', { exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /Assignments/ }).click()
  await page.getByLabel('Add private file').setInputFiles(files)
  await expect(page.getByText('2 file(s) attached to this draft.')).toBeVisible()
  await page.getByLabel('Attachment name for study.pdf').fill('Practice instructions')
  const row = page.getByLabel('Attachment name for study.pdf').locator('..').locator('..')
  await row.getByRole('button', { name: 'Save attachment name' }).click()
  await expect(page.getByText('Practice instructions · study.pdf', { exact: true })).toBeVisible()
  expect(
    await page.evaluate("getComputedStyle(document.querySelector('[class*=materialRow]')).display"),
  ).toBe('grid')
  await page.screenshot({ path: 'test-results/f035/teacher-content.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
})

test('topic removal requires impact confirmation and deliberate unlinking', async ({ page }) => {
  await page.goto('/teacher/content?preview=1')
  await page.getByRole('button', { name: 'Preview topic removal' }).click()
  await expect(page.getByRole('button', { name: 'Confirm remove topic' })).toBeDisabled()
  await page.getByRole('button', { name: /Unlink draft assignment:/ }).click()
  await expect(page.getByRole('button', { name: 'Confirm remove topic' })).toBeEnabled()
  await page.getByRole('button', { name: 'Confirm remove topic' }).click()
  await expect(page.getByRole('button', { name: /Drawing foundationsPerspective/ })).toHaveCount(0)
  await expect(page.getByLabel('Topic title')).not.toHaveValue('Perspective')
})

test('named lesson uploads enforce existing five-file limit on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/teacher/content?preview=1')
  await page.getByLabel('Attach lesson files').setInputFiles(
    Array.from({ length: 6 }, (_, index) => ({
      name: `reference-${index}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fictional'),
    })),
  )
  await expect(page.getByRole('alert')).toContainText('limit is 5')
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
})
