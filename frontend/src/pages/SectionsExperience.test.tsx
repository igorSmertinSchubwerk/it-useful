import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { server } from '../test/server'

const session = {
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'CONFIRMED',
  csrf: { headerName: 'X-CSRF-TOKEN', token: 'session-csrf-token' },
}

beforeEach(() => {
  localStorage.clear()
  server.use(
    http.get('http://localhost/api/elements', () => HttpResponse.json([])),
    http.get('http://localhost/api/admin/*', () => HttpResponse.json([])),
  )
})

function renderApp(path: string, role?: 'ADMIN' | 'USER') {
  if (role)
    server.use(
      http.get('http://localhost/api/session', () =>
        HttpResponse.json({ ...session, role }),
      ),
    )
  const router = createMemoryRouter(
    [{ path: '*', element: <App authenticationEnabled={Boolean(role)} /> }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

function names(elements: HTMLElement[]) {
  return elements.map((element) => {
    const labelledBy = element.getAttribute('aria-labelledby')
    return labelledBy
      ? document.getElementById(labelledBy)?.textContent
      : (element.getAttribute('aria-label') ?? element.textContent)
  })
}

test.each(['/it-definitions', '/it-definitions/new', '/settings'])(
  '%s has only the main menu, with Dashboard and IT definitions',
  async (path) => {
    renderApp(path)
    const main = await screen.findByRole('navigation', {
      name: 'Main navigation',
    })
    expect(names(within(main).getAllByRole('link'))).toEqual([
      'Dashboard',
      'IT definitions',
    ])
    expect(names(screen.getAllByRole('navigation'))).toEqual([
      'Main navigation',
    ])
  },
)

test('New definition is one button beside the list heading and keeps the list filters', async () => {
  renderApp('/it-definitions?language=DE')
  const heading = await screen.findByRole('heading', { level: 1 })

  const create = screen.getAllByRole('link', { name: 'New definition' })
  expect(create).toHaveLength(1)
  expect(create[0]).toHaveAttribute('href', '/it-definitions/new?language=DE')
  expect(create[0].parentElement).toContainElement(heading)
})

test('an admin on the server variant sees General, Accounts, and Change password as cards', async () => {
  renderApp('/settings', 'ADMIN')

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible()
  const main = screen.getByRole('main')
  expect(names(within(main).getAllByRole('region'))).toEqual([
    'General',
    'Accounts',
    'Change password',
  ])
  const accounts = screen.getByRole('region', { name: 'Accounts' })
  expect(
    within(accounts).getByRole('heading', { level: 3, name: 'Invite someone' }),
  ).toBeVisible()
  const password = screen.getByRole('region', { name: 'Change password' })
  expect(within(password).getByLabelText('Current password')).toBeVisible()
})

test('a user on the server variant sees General and Change password', async () => {
  renderApp('/settings', 'USER')
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  expect(
    names(within(screen.getByRole('main')).getAllByRole('region')),
  ).toEqual(['General', 'Change password'])
})

test('local mode shows only the General card', async () => {
  renderApp('/settings')
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  expect(
    names(within(screen.getByRole('main')).getAllByRole('region')),
  ).toEqual(['General'])
})

test.each([
  '/settings/accounts',
  '/settings/password',
  '/admin/accounts',
  '/account/password',
])('the former address %s opens the Settings page', async (path) => {
  const router = renderApp(path, 'ADMIN')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible()
  expect(router.state.location.pathname).toBe('/settings')
})

test('the settings icon marks itself as the current page on Settings', async () => {
  renderApp('/settings')
  await screen.findByRole('heading', { level: 1, name: 'Settings' })
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Settings' }),
  ).toHaveAttribute('aria-current', 'page')
})

test.each([
  ['/', 'dashboard'],
  ['/it-definitions', 'definitions'],
  ['/it-definitions/new', 'definitions'],
  ['/settings', 'settings'],
  ['/legal-notice', 'neutral'],
])('%s uses the %s colors for the page and the dock', async (path, section) => {
  renderApp(path)
  await screen.findByRole('heading', { level: 1 })
  const themed = screen.getByRole('banner').closest('[data-section]')
  expect(themed).toHaveAttribute('data-section', section)
  expect(themed).toContainElement(screen.getByRole('main'))
})
