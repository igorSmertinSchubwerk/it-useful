import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { elementFixture } from '../src/test/elementFixture'

const session = {
  authenticated: true,
  role: 'OWNER',
  login: 'approved-owner',
  csrf: { headerName: 'X-CSRF-TOKEN', token: 'browser-csrf-token' },
}

test('anonymous user gets the accessible GitHub sign-in screen', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 401, json: { code: 'authentication_required' } }),
  )
  await page.goto('/elements/new')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Sign in with GitHub' }),
  ).toHaveAttribute('href', '/oauth2/authorization/github')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('owner can sign out and the CSRF token never enters browser storage', async ({
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
  await expect(page.getByText('Signed in as approved-owner')).toBeVisible()
  const storedValues = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ])
  expect(storedValues).not.toContain('browser-csrf-token')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(csrf).toBe('browser-csrf-token')
})

test('successful authentication returns to the remembered internal page', async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'it-useful.auth-return',
      '/elements/example-id?language=DE',
    ),
  )
  await page.route('**/api/session', (route) =>
    route.fulfill({ json: session }),
  )
  await page.route('**/api/elements/example-id', (route) =>
    route.fulfill({ json: elementFixture }),
  )
  await page.goto('/')
  await expect(page).toHaveURL(/\/elements\/example-id\?language=DE$/)
  await expect(
    page.getByRole('heading', { name: 'Definition details' }),
  ).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
})

test('denied and expired sessions have different recovery screens', async ({
  page,
}) => {
  await page.route('**/api/session', (route) =>
    route.fulfill({ status: 403, json: { code: 'forbidden' } }),
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
