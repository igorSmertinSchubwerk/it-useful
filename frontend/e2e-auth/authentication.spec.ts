import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

const session = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf: { headerName: 'X-CSRF-TOKEN', token: 'browser-csrf-token' },
}

async function routeAnonymousUntilSignedIn(page: Page) {
  let signedIn = false
  await page.route('**/api/session', (route) =>
    signedIn
      ? route.fulfill({ json: session })
      : route.fulfill({
          status: 401,
          json: { code: 'authentication_required' },
        }),
  )
  await page.route('**/api/session/csrf', (route) =>
    route.fulfill({
      json: { headerName: 'X-CSRF-TOKEN', token: 'anonymous-csrf-token' },
    }),
  )
  await page.route('**/api/session/login', (route) => {
    signedIn = true
    return route.fulfill({ status: 204 })
  })
}

test('anonymous user gets the accessible email sign-in screen', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  await page.goto('/it-definitions/new')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('signing in returns to the page that required it', async ({ page }) => {
  await routeAnonymousUntilSignedIn(page)
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.goto('/it-definitions/example-id?language=DE')
  await expect(page).toHaveURL(/\/sign-in$/)

  await page.getByLabel('Email address').fill('admin@example.com')
  await page.getByLabel('Password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/it-definitions\/example-id\?language=DE$/)
  await expect(
    page.getByRole('heading', { name: 'Definition details' }),
  ).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
})

test('signed-in user can sign out and the CSRF token never enters browser storage', async ({
  page,
}) => {
  let csrf: string | null = null
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: session }),
  )
  await page.route('**/api/elements', (route) => route.fulfill({ json: [] }))
  await page.route('**/logout', (route) => {
    csrf = route.request().headers()['x-csrf-token'] ?? null
    return route.fulfill({ status: 204 })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Account' }).click()
  const account = page.getByRole('region', { name: 'Account' })
  await expect(account.getByText('admin@example.com')).toBeVisible()
  const storedValues = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ])
  expect(storedValues).not.toContain('browser-csrf-token')
  await account.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(csrf).toBe('browser-csrf-token')
})

test('denied and expired sessions have different recovery screens', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { ...session, status: 'DISABLED' } }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Access denied' }),
  ).toBeVisible()

  await page.unroute('**/api/session')
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: session }),
  )
  await page.route('**/api/elements', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Session expired' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in again' })).toBeVisible()
})

test('an invitee creates an account on an accessible page and lands on sign-in', async ({
  page,
}) => {
  let body: unknown = null
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  await page.route('**/api/session/csrf', (route) =>
    route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'csrf' } }),
  )
  await page.route('**/api/invitations/accept', (route) => {
    body = route.request().postDataJSON()
    return route.fulfill({ status: 204 })
  })
  await page.goto('/accept-invitation#browser-token')
  await expect(
    page.getByRole('heading', { name: 'Create your account' }),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.getByLabel('New password').fill('correct horse battery staple')
  await page.getByLabel('Repeat password').fill('correct horse battery staple')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('status')).toContainText('Your account is ready')
  expect(body).toEqual({
    token: 'browser-token',
    password: 'correct horse battery staple',
  })
})

test('the admin accounts card is accessible', async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: session }),
  )
  await page.route('**/api/admin/accounts', (route) =>
    route.fulfill({
      json: [
        {
          id: '00000000-0000-0000-0000-0000000000c1',
          email: 'pending@example.com',
          role: 'USER',
          status: 'ACCEPTED',
          createdAt: '2026-11-24T09:00:00Z',
        },
      ],
    }),
  )
  await page.goto('/settings')
  await expect(
    page.getByRole('heading', { name: 'Accounts', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('pending@example.com')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('the password reset and password change pages are accessible', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  await page.goto('/reset-password#browser-reset-token')
  await expect(
    page.getByRole('heading', { name: 'Choose a new password' }),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

  await page.unroute('**/api/session')
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: { ...session, role: 'USER' } }),
  )
  await page.goto('/settings')
  await expect(
    page.getByRole('heading', { name: 'Change password' }),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('the legal pages are accessible', async ({ page }) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  for (const path of ['/legal-notice', '/privacy']) {
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
})
