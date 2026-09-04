import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/elements', (route) => route.fulfill({ json: [] }))
})

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
  await expect(
    page.getByText('No definitions yet.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Definition language' }),
  ).toHaveValue('EN')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(errors).toEqual([])
})
