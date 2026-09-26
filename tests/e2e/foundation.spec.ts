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
