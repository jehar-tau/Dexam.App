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

test('Enrolment Operator reviews and issues a fictional activation pack', async ({ page }) => {
  await page.goto('/staff/enrolments?preview=1')

  await expect(page.getByRole('heading', { name: 'Activation queue' })).toBeVisible()
  await page.getByRole('button', { name: 'Review enrolment' }).click()
  await expect(page.getByRole('heading', { name: 'Issue activation pack?' })).toBeVisible()

  await page.getByRole('button', { name: 'Issue activation pack' }).click()

  await expect(
    page.getByRole('heading', { name: 'Hand this directly to the student.' }),
  ).toBeVisible()
  await expect(page.getByText('7K3M9Q2RW5')).toBeVisible()
})
