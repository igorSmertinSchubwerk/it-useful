import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { server } from '../test/server'

const adminSession = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf: { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' },
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  server.use(
    http.get('http://localhost/api/elements', () => HttpResponse.json([])),
  )
})

function renderApp(path: string, authenticationEnabled = false) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App authenticationEnabled={authenticationEnabled} />,
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function signInAsAdmin() {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json(adminSession),
    ),
    http.post('http://localhost/logout', () =>
      HttpResponse.json(null, { status: 204 }),
    ),
  )
}

test('the account menu names the signed-in account and signs out', async () => {
  signInAsAdmin()
  renderApp('/', true)
  const user = userEvent.setup()

  const account = await screen.findByRole('button', { name: 'Account' })
  expect(account).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('Signed in as admin@example.com')).toBeNull()

  await user.click(account)
  expect(account).toHaveAttribute('aria-expanded', 'true')
  const menu = screen.getByRole('region', { name: 'Account' })
  expect(within(menu).getByText('admin@example.com')).toBeVisible()
  await user.click(within(menu).getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
})

function headerControls() {
  return [...screen.getByRole('banner').querySelectorAll('[aria-label]')]
    .map((element) => element.getAttribute('aria-label'))
    .filter((label) => !label?.endsWith('navigation'))
}

test('the header ends with theme, language, settings, and account icons', async () => {
  const router = renderApp('/')
  const user = userEvent.setup()
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()

  expect(headerControls()).toEqual([
    'Dark mode',
    'Interface language',
    'Settings',
    'Account',
  ])

  await user.click(screen.getByRole('button', { name: 'Account' }))
  const menu = screen.getByRole('region', { name: 'Account' })
  expect(within(menu).getByText('Local mode')).toBeVisible()
  expect(within(menu).queryByRole('button')).toBeNull()

  const settings = within(screen.getByRole('banner'))
    .getAllByRole('link', { name: 'Settings' })
    .at(-1)
  await user.click(settings!)
  expect(router.state.location.pathname).toBe('/settings')
})

test('the language menu switches and remembers the interface language', async () => {
  renderApp('/')
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: 'Interface language' }),
  )
  const menu = screen.getByRole('region', { name: 'Interface language' })
  expect(
    within(menu).getByRole('button', { name: 'English', pressed: true }),
  ).toBeVisible()

  await user.click(within(menu).getByRole('button', { name: 'Deutsch' }))

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Übersicht' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Sprache der Oberfläche' }),
  ).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Sprache der Oberfläche' }),
  ).toHaveFocus()
  expect(localStorage.getItem('it-useful.ui-language')).toBe('de')
})

test('the theme button switches dark mode and remembers the choice', async () => {
  renderApp('/')
  const user = userEvent.setup()
  const toggle = await screen.findByRole('button', { name: 'Dark mode' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(document.documentElement.dataset.theme).toBe('light')

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('it-useful.theme')).toBe('dark')

  await user.click(toggle)
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('it-useful.theme')).toBe('light')
})

test('a saved dark theme applies on the next visit', async () => {
  localStorage.setItem('it-useful.theme', 'dark')
  renderApp('/')
  expect(
    await screen.findByRole('button', { name: 'Dark mode', pressed: true }),
  ).toBeVisible()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('a header menu closes on Escape and on a click elsewhere', async () => {
  renderApp('/')
  const user = userEvent.setup()
  const account = await screen.findByRole('button', { name: 'Account' })

  await user.click(account)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('region', { name: 'Account' })).toBeNull()
  expect(account).toHaveFocus()

  await user.click(account)
  await user.click(screen.getByRole('button', { name: 'Interface language' }))
  expect(screen.queryByRole('region', { name: 'Account' })).toBeNull()
  expect(
    screen.getByRole('region', { name: 'Interface language' }),
  ).toBeVisible()
})

test('a press on text inside an open menu keeps it open', async () => {
  signInAsAdmin()
  renderApp('/', true)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Account' }))

  const menu = screen.getByRole('region', { name: 'Account' })
  await user.click(within(menu).getByText('admin@example.com'))

  expect(menu).toBeVisible()
})

test('a header menu closes when keyboard focus leaves it', async () => {
  renderApp('/')
  const user = userEvent.setup()
  const language = await screen.findByRole('button', {
    name: 'Interface language',
  })
  language.focus()
  await user.keyboard('{Enter}')
  expect(
    screen.getByRole('region', { name: 'Interface language' }),
  ).toBeVisible()

  await user.tab()
  await user.tab()
  await user.tab()
  await user.tab()

  const settingsIcon = within(screen.getByRole('banner'))
    .getAllByRole('link', { name: 'Settings' })
    .at(-1)
  expect(settingsIcon).toHaveFocus()
  expect(
    screen.queryByRole('region', { name: 'Interface language' }),
  ).toBeNull()
})

test('a signed-out visitor gets only the theme and language icons', async () => {
  server.use(
    http.get('http://localhost/api/session', () =>
      HttpResponse.json({ code: 'authentication_required' }, { status: 401 }),
    ),
  )
  renderApp('/', true)
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(headerControls()).toEqual(['Dark mode', 'Interface language'])
})
