import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('renders the foundation without console errors or detected accessibility violations', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await expect(page).toHaveTitle('A home for your IT knowledge | IT Useful')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const name of ['English', 'Deutsch', 'Русский']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(errors).toEqual([])
})
