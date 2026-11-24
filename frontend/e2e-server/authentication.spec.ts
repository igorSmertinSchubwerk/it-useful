import { expect, test } from '@playwright/test'

test('server frontend keeps private routes behind the email sign-in screen', async ({
  page,
}) => {
  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/session') &&
      response.request().method() === 'GET',
  )

  await page.goto('/elements/private-definition?language=DE')

  expect((await sessionResponse).status()).toBe(401)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.locator('nav')).toHaveCount(0)
})
