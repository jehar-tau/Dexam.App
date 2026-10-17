import { expect, test } from '@playwright/test'

// Fictional preview interaction coverage only. Database/actual API acceptance remains separate.
test('operator reuses a claimed student rather than issuing duplicate activation', async ({
  page,
}) => {
  await page.goto('/staff/enrolment-handoffs?preview=1')
  await page.getByLabel('Use an existing student').check()
  await page.getByLabel('Find existing student').fill('Anika')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByLabel(/Anika Kulkarni/).check()
  await page.getByLabel('Same person', { exact: true }).check()
  await page
    .getByLabel('Course and cohort')
    .selectOption('preview-offering-foundation|preview-cohort-weekend')
  await page.getByLabel('Approval reason').fill('Established canonical account confirmed.')
  await page.getByRole('button', { name: 'Approve enrolment' }).click()

  await expect(
    page.getByText(/linked to the existing account and enrolled immediately/),
  ).toBeVisible()
  await expect(page.getByText(/DXM-7K3M9Q2RW5TY/)).toBeVisible()
  await expect(page.getByText(/added to the activation queue/)).toHaveCount(0)
})

test('operator returns an incomplete handoff without creating student access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/staff/enrolment-handoffs?preview=1')
  await expect(page.getByRole('button', { name: 'Return request' })).toBeDisabled()
  await page.getByLabel('Return reason').fill('  ')
  await expect(page.getByRole('button', { name: 'Return request' })).toBeDisabled()
  await page.getByLabel('Return reason').fill('Confirm the intended cohort with the prospect.')
  await page.getByRole('button', { name: 'Return request' }).click()

  await expect(page.getByText(/returned to Sales. No student access was created/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Meera Kulkarni' })).toHaveCount(0)
  await expect(page.getByText(/DXM-3F7K9M2RW5TY/)).toHaveCount(0)
})

test('operator cannot approve a handoff with an unresolved identity candidate', async ({
  page,
}) => {
  await page.goto('/staff/enrolment-handoffs?preview=1')
  await page
    .getByLabel('Course and cohort')
    .selectOption('preview-offering-foundation|preview-cohort-weekend')
  await page.getByLabel('Approval reason').fill('Course reviewed, identity still unresolved.')
  await page.getByRole('button', { name: 'Approve enrolment' }).click()

  await expect(page.getByRole('heading', { name: 'Meera Kulkarni' })).toBeVisible()
  await expect(page.getByText(/added to the activation queue/)).toHaveCount(0)
  await expect(page.getByLabel('Different people')).not.toBeChecked()
  await expect(page.getByLabel('Same person', { exact: true })).not.toBeChecked()
  await expect(
    page.getByText('Classify every possible identity match before approval.'),
  ).toBeVisible()
})
